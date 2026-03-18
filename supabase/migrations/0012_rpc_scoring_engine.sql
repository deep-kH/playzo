
-- Internal helper: ensure stats rows exist
create or replace function public._ensure_batting_row(p_innings_id uuid, p_player_id uuid)
returns void
language sql
as $func$
  insert into public.ls_batting_stats (innings_id, player_id)
  values (p_innings_id, p_player_id)
  on conflict (innings_id, player_id) do nothing;
$func$;

create or replace function public._ensure_bowling_row(p_innings_id uuid, p_player_id uuid)
returns void
language sql
as $func$
  insert into public.ls_bowling_stats (innings_id, player_id)
  values (p_innings_id, p_player_id)
  on conflict (innings_id, player_id) do nothing;
$func$;

-- Match setup (used by the app)
create or replace function public.rpc_setup_match(
  p_match_id uuid,
  p_toss_winner_id uuid,
  p_toss_decision text,
  p_playing_xi_a text[],
  p_playing_xi_b text[],
  p_opening_striker_id uuid,
  p_opening_non_striker_id uuid,
  p_opening_bowler_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_team_a uuid;
  v_team_b uuid;
  v_bat uuid;
  v_bowl uuid;
  v_innings1 uuid;
begin
  -- Lock match row to prevent concurrent setup
  select team_a_id, team_b_id
  into v_team_a, v_team_b
  from public.ls_matches
  where id = p_match_id
  for update;

  if v_team_a is null then
    raise exception 'match % not found', p_match_id;
  end if;

  if p_toss_decision not in ('bat','bowl') then
    raise exception 'invalid toss decision: %', p_toss_decision;
  end if;

  -- Determine who bats first based on toss
  if p_toss_decision = 'bat' then
    v_bat := p_toss_winner_id;
  else
    if p_toss_winner_id = v_team_a then
      v_bat := v_team_b;
    else
      v_bat := v_team_a;
    end if;
  end if;

  if v_bat = v_team_a then
    v_bowl := v_team_b;
  else
    v_bowl := v_team_a;
  end if;

  -- Upsert innings 1
  insert into public.ls_innings (
    match_id, innings_number, batting_team_id, bowling_team_id, status
  )
  values (p_match_id, 1, v_bat, v_bowl, 'in_progress'::public.innings_status)
  on conflict (match_id, innings_number) do update
    set batting_team_id = excluded.batting_team_id,
        bowling_team_id = excluded.bowling_team_id,
        status = excluded.status
  returning id into v_innings1;

  -- Persist match metadata and set live
  update public.ls_matches
  set status = 'live'::public.match_status,
      toss = jsonb_build_object('winner_id', p_toss_winner_id, 'decision', p_toss_decision),
      playing_xi = jsonb_build_object('team_a', p_playing_xi_a, 'team_b', p_playing_xi_b)
  where id = p_match_id;

  -- Ensure match_state exists (trigger does it too)
  insert into public.ls_match_state (match_id)
  values (p_match_id)
  on conflict (match_id) do nothing;

  -- Initialize match_state
  update public.ls_match_state
  set current_innings_id = v_innings1,
      striker_id = p_opening_striker_id,
      non_striker_id = p_opening_non_striker_id,
      current_bowler_id = p_opening_bowler_id,
      current_over = 0,
      current_ball = 0,
      partnership_runs = 0,
      partnership_balls = 0,
      score_runs = 0,
      score_wickets = 0,
      score_overs = 0,
      score_extras = 0,
      balls_this_over = '[]'::jsonb,
      last_ball_id = null,
      last_event = 'match_setup'
  where match_id = p_match_id;

  perform public._ensure_batting_row(v_innings1, p_opening_striker_id);
  perform public._ensure_batting_row(v_innings1, p_opening_non_striker_id);
  perform public._ensure_bowling_row(v_innings1, p_opening_bowler_id);
end;
$func$;

-- Core scoring engine (requested canonical RPC names)
create or replace function public.process_ball(
  p_match_id uuid,
  p_runs_bat integer,
  p_runs_extra integer,
  p_extra_type text,
  p_is_wicket boolean,
  p_wicket_type public.wicket_type,
  p_wicket_player_id uuid,
  p_fielder_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_state public.ls_match_state%rowtype;
  v_innings public.ls_innings%rowtype;
  v_seq integer;
  v_over smallint;
  v_ball smallint;
  v_is_legal boolean;
  v_total_runs integer;
  v_batting_row public.ls_batting_stats%rowtype;
  v_bowling_row public.ls_bowling_stats%rowtype;
  v_ball_id uuid;
  v_last_over_balls jsonb;
begin
  if p_runs_bat < 0 or p_runs_extra < 0 then
    raise exception 'runs cannot be negative';
  end if;

  select *
  into v_state
  from public.ls_match_state
  where match_id = p_match_id
  for update;

  if v_state.match_id is null then
    raise exception 'match_state missing for match %', p_match_id;
  end if;

  if v_state.current_innings_id is null then
    raise exception 'current innings not set for match %', p_match_id;
  end if;

  if v_state.striker_id is null or v_state.non_striker_id is null or v_state.current_bowler_id is null then
    raise exception 'striker/non_striker/bowler not set for match %', p_match_id;
  end if;

  select *
  into v_innings
  from public.ls_innings
  where id = v_state.current_innings_id
  for update;

  if v_innings.status <> 'in_progress'::public.innings_status then
    raise exception 'innings % not in progress', v_innings.id;
  end if;

  -- Determine legality: wides & no-balls are not legal deliveries.
  v_is_legal := not (p_extra_type in ('wide', 'no_ball'));

  -- Sequence per innings
  select coalesce(max(sequence), 0) + 1
  into v_seq
  from public.ls_balls
  where innings_id = v_innings.id;

  v_over := v_state.current_over;
  v_ball := v_state.current_ball + 1; -- ball number shown to users (1..6), repeats for illegal

  v_total_runs := p_runs_bat + p_runs_extra;

  insert into public.ls_balls (
    innings_id,
    over_number,
    ball_number,
    sequence,
    batter_id,
    non_striker_id,
    bowler_id,
    runs_bat,
    runs_extra,
    extra_type,
    is_wicket,
    wicket_type,
    wicket_player_id,
    fielder_id,
    is_legal
  )
  values (
    v_innings.id,
    v_over,
    v_ball,
    v_seq,
    v_state.striker_id,
    v_state.non_striker_id,
    v_state.current_bowler_id,
    p_runs_bat,
    p_runs_extra,
    nullif(p_extra_type, ''),
    coalesce(p_is_wicket, false),
    p_wicket_type,
    p_wicket_player_id,
    p_fielder_id,
    v_is_legal
  )
  returning id into v_ball_id;

  perform public._ensure_batting_row(v_innings.id, v_state.striker_id);
  perform public._ensure_batting_row(v_innings.id, v_state.non_striker_id);
  perform public._ensure_bowling_row(v_innings.id, v_state.current_bowler_id);

  -- Update batting: striker gets bat runs; ball faced only on legal deliveries (no wide/no-ball)
  update public.ls_batting_stats
  set runs = runs + p_runs_bat,
      balls_faced = balls_faced + case when v_is_legal then 1 else 0 end,
      fours = fours + case when p_runs_bat = 4 then 1 else 0 end,
      sixes = sixes + case when p_runs_bat = 6 then 1 else 0 end
  where innings_id = v_innings.id
    and player_id = v_state.striker_id;

  -- Wicket handling
  if coalesce(p_is_wicket, false) then
    update public.ls_batting_stats
    set is_out = true,
        dismissal_type = p_wicket_type,
        dismissal_bowler_id = v_state.current_bowler_id,
        dismissal_fielder_id = p_fielder_id
    where innings_id = v_innings.id
      and player_id = coalesce(p_wicket_player_id, v_state.striker_id);

    update public.ls_bowling_stats
    set wickets = wickets + 1
    where innings_id = v_innings.id
      and player_id = v_state.current_bowler_id;

    update public.ls_innings
    set total_wickets = total_wickets + 1
    where id = v_innings.id;
  end if;

  -- Bowling runs conceded (simplified; byes/legbyes not separated here)
  update public.ls_bowling_stats
  set runs_conceded = runs_conceded + v_total_runs,
      wides = wides + case when p_extra_type = 'wide' then 1 else 0 end,
      no_balls = no_balls + case when p_extra_type = 'no_ball' then 1 else 0 end,
      dot_balls = dot_balls + case when v_is_legal and v_total_runs = 0 and not coalesce(p_is_wicket,false) then 1 else 0 end
  where innings_id = v_innings.id
    and player_id = v_state.current_bowler_id;

  -- Innings totals
  update public.ls_innings
  set total_runs = total_runs + v_total_runs,
      total_extras = total_extras + p_runs_extra
  where id = v_innings.id;

  -- Over/ball progression (legal deliveries only)
  v_last_over_balls := coalesce(v_state.balls_this_over, '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object(
        'over_number', v_over,
        'ball_number', v_ball,
        'runs_bat', p_runs_bat,
        'runs_extra', p_runs_extra,
        'extra_type', nullif(p_extra_type,''),
        'is_wicket', coalesce(p_is_wicket,false),
        'is_legal', v_is_legal
      )
    );

  if v_is_legal then
    if v_state.current_ball = 5 then
      -- Over complete
      update public.ls_match_state
      set current_over = current_over + 1,
          current_ball = 0,
          last_ball_id = v_ball_id,
          balls_this_over = '[]'::jsonb,
          partnership_runs = partnership_runs + v_total_runs,
          partnership_balls = partnership_balls + 1,
          score_runs = score_runs + v_total_runs,
          score_extras = score_extras + p_runs_extra,
          score_wickets = score_wickets + case when coalesce(p_is_wicket,false) then 1 else 0 end,
          score_overs = (current_over + 1)::numeric,
          last_event = case when coalesce(p_is_wicket,false) then 'wicket' else 'ball' end
      where match_id = p_match_id;
    else
      update public.ls_match_state
      set current_ball = current_ball + 1,
          last_ball_id = v_ball_id,
          balls_this_over = v_last_over_balls,
          partnership_runs = partnership_runs + v_total_runs,
          partnership_balls = partnership_balls + 1,
          score_runs = score_runs + v_total_runs,
          score_extras = score_extras + p_runs_extra,
          score_wickets = score_wickets + case when coalesce(p_is_wicket,false) then 1 else 0 end,
          score_overs = (current_over + ((current_ball + 1)::numeric / 10)),
          last_event = case when coalesce(p_is_wicket,false) then 'wicket' else 'ball' end
      where match_id = p_match_id;
    end if;
  else
    -- Illegal delivery: does not advance ball count
    update public.ls_match_state
    set last_ball_id = v_ball_id,
        balls_this_over = v_last_over_balls,
        partnership_runs = partnership_runs + v_total_runs,
        score_runs = score_runs + v_total_runs,
        score_extras = score_extras + p_runs_extra,
        last_event = 'extra'
    where match_id = p_match_id;
  end if;

  -- Keep innings.total_overs aligned to match_state
  select *
  into v_state
  from public.ls_match_state
  where match_id = p_match_id;

  update public.ls_innings
  set total_overs = v_state.score_overs
  where id = v_innings.id;

  -- Snapshots (small, denormalized for UI)
  select * into v_batting_row
  from public.ls_batting_stats
  where innings_id = v_innings.id and player_id = v_state.striker_id;

  select * into v_bowling_row
  from public.ls_bowling_stats
  where innings_id = v_innings.id and player_id = v_state.current_bowler_id;

  update public.ls_match_state
  set striker_snapshot = to_jsonb(v_batting_row),
      bowler_snapshot = to_jsonb(v_bowling_row)
  where match_id = p_match_id;
end;
$func$;

create or replace function public.undo_last_ball(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_state public.ls_match_state%rowtype;
  v_innings public.ls_innings%rowtype;
  v_ball public.ls_balls%rowtype;
  v_total_runs integer;
  v_is_legal boolean;
begin
  select * into v_state
  from public.ls_match_state
  where match_id = p_match_id
  for update;

  if v_state.last_ball_id is null then
    return;
  end if;

  select * into v_ball
  from public.ls_balls
  where id = v_state.last_ball_id
  for update;

  if v_ball.id is null then
    -- stale pointer
    update public.ls_match_state set last_ball_id = null where match_id = p_match_id;
    return;
  end if;

  select * into v_innings
  from public.ls_innings
  where id = v_ball.innings_id
  for update;

  v_total_runs := v_ball.runs_bat + v_ball.runs_extra;
  v_is_legal := v_ball.is_legal;

  -- Reverse batting (only striker faced for legal)
  update public.ls_batting_stats
  set runs = greatest(0, runs - v_ball.runs_bat),
      balls_faced = greatest(0, balls_faced - case when v_is_legal then 1 else 0 end),
      fours = greatest(0, fours - case when v_ball.runs_bat = 4 then 1 else 0 end),
      sixes = greatest(0, sixes - case when v_ball.runs_bat = 6 then 1 else 0 end)
  where innings_id = v_innings.id
    and player_id = v_ball.batter_id;

  -- Reverse wicket (best-effort)
  if v_ball.is_wicket then
    update public.ls_batting_stats
    set is_out = false,
        dismissal_type = null,
        dismissal_bowler_id = null,
        dismissal_fielder_id = null
    where innings_id = v_innings.id
      and player_id = coalesce(v_ball.wicket_player_id, v_ball.batter_id);

    update public.ls_bowling_stats
    set wickets = greatest(0, wickets - 1)
    where innings_id = v_innings.id
      and player_id = v_ball.bowler_id;

    update public.ls_innings
    set total_wickets = greatest(0, total_wickets - 1)
    where id = v_innings.id;
  end if;

  -- Reverse bowling
  update public.ls_bowling_stats
  set runs_conceded = greatest(0, runs_conceded - v_total_runs),
      wides = greatest(0, wides - case when v_ball.extra_type = 'wide' then 1 else 0 end),
      no_balls = greatest(0, no_balls - case when v_ball.extra_type = 'no_ball' then 1 else 0 end),
      dot_balls = greatest(
        0,
        dot_balls - case when v_is_legal and v_total_runs = 0 and not v_ball.is_wicket then 1 else 0 end
      )
  where innings_id = v_innings.id
    and player_id = v_ball.bowler_id;

  -- Reverse innings totals
  update public.ls_innings
  set total_runs = greatest(0, total_runs - v_total_runs),
      total_extras = greatest(0, total_extras - v_ball.runs_extra)
  where id = v_innings.id;

  -- Delete ball
  delete from public.ls_balls where id = v_ball.id;

  -- Recompute current over/ball from remaining balls (fast path: last legal ball)
  with last_legal as (
    select over_number, ball_number
    from public.ls_balls
    where innings_id = v_innings.id
      and is_legal = true
    order by sequence desc
    limit 1
  )
  update public.ls_match_state ms
  set current_over = coalesce((select over_number from last_legal), 0),
      current_ball = coalesce((select ball_number from last_legal), 0) % 6,
      last_ball_id = (
        select id
        from public.ls_balls
        where innings_id = v_innings.id
        order by sequence desc
        limit 1
      ),
      balls_this_over = '[]'::jsonb,
      partnership_runs = greatest(0, partnership_runs - v_total_runs),
      partnership_balls = greatest(0, partnership_balls - case when v_is_legal then 1 else 0 end),
      score_runs = greatest(0, score_runs - v_total_runs),
      score_extras = greatest(0, score_extras - v_ball.runs_extra),
      score_wickets = greatest(0, score_wickets - case when v_ball.is_wicket then 1 else 0 end),
      score_overs = (coalesce((select over_number from last_legal), 0)::numeric
        + (coalesce((select ball_number from last_legal), 0) % 6)::numeric / 10),
      last_event = 'undo'
  where ms.match_id = p_match_id;

  update public.ls_innings
  set total_overs = (select score_overs from public.ls_match_state where match_id = p_match_id)
  where id = v_innings.id;
end;
$func$;

create or replace function public.set_new_batter(
  p_match_id uuid,
  p_new_player_id uuid,
  p_is_striker boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_state public.ls_match_state%rowtype;
begin
  select * into v_state
  from public.ls_match_state
  where match_id = p_match_id
  for update;

  if v_state.current_innings_id is null then
    raise exception 'current innings not set';
  end if;

  if p_is_striker then
    update public.ls_match_state
    set striker_id = p_new_player_id,
        last_event = 'new_batter'
    where match_id = p_match_id;
  else
    update public.ls_match_state
    set non_striker_id = p_new_player_id,
        last_event = 'new_batter'
    where match_id = p_match_id;
  end if;

  perform public._ensure_batting_row(v_state.current_innings_id, p_new_player_id);
end;
$func$;

create or replace function public.set_new_bowler(
  p_match_id uuid,
  p_new_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_state public.ls_match_state%rowtype;
begin
  select * into v_state
  from public.ls_match_state
  where match_id = p_match_id
  for update;

  if v_state.current_innings_id is null then
    raise exception 'current innings not set';
  end if;

  update public.ls_match_state
  set current_bowler_id = p_new_player_id,
      last_event = 'new_bowler'
  where match_id = p_match_id;

  perform public._ensure_bowling_row(v_state.current_innings_id, p_new_player_id);
end;
$func$;

create or replace function public.start_second_innings(
  p_match_id uuid,
  p_opening_striker_id uuid,
  p_opening_non_striker_id uuid,
  p_opening_bowler_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_match public.ls_matches%rowtype;
  v_inn1 public.ls_innings%rowtype;
  v_inn2_id uuid;
  v_bat uuid;
  v_bowl uuid;
begin
  select * into v_match
  from public.ls_matches
  where id = p_match_id
  for update;

  if v_match.id is null then
    raise exception 'match not found';
  end if;

  select * into v_inn1
  from public.ls_innings
  where match_id = p_match_id and innings_number = 1
  for update;

  if v_inn1.id is null then
    raise exception 'innings 1 missing';
  end if;

  v_bat := v_inn1.bowling_team_id;
  v_bowl := v_inn1.batting_team_id;

  insert into public.ls_innings (
    match_id, innings_number, batting_team_id, bowling_team_id, status
  )
  values (p_match_id, 2, v_bat, v_bowl, 'in_progress'::public.innings_status)
  on conflict (match_id, innings_number) do update
    set batting_team_id = excluded.batting_team_id,
        bowling_team_id = excluded.bowling_team_id,
        status = excluded.status
  returning id into v_inn2_id;

  insert into public.ls_match_state (match_id)
  values (p_match_id)
  on conflict (match_id) do nothing;

  update public.ls_match_state
  set current_innings_id = v_inn2_id,
      striker_id = p_opening_striker_id,
      non_striker_id = p_opening_non_striker_id,
      current_bowler_id = p_opening_bowler_id,
      current_over = 0,
      current_ball = 0,
      last_ball_id = null,
      partnership_runs = 0,
      partnership_balls = 0,
      balls_this_over = '[]'::jsonb,
      target_score = v_inn1.total_runs + 1,
      score_runs = 0,
      score_wickets = 0,
      score_overs = 0,
      score_extras = 0,
      last_event = 'start_second_innings'
  where match_id = p_match_id;

  perform public._ensure_batting_row(v_inn2_id, p_opening_striker_id);
  perform public._ensure_batting_row(v_inn2_id, p_opening_non_striker_id);
  perform public._ensure_bowling_row(v_inn2_id, p_opening_bowler_id);
end;
$func$;

create or replace function public."rpc_process_ball_atomic"(
  p_match_id uuid,
  p_runs_bat integer,
  p_runs_extra integer,
  p_extra_type text,
  p_is_wicket boolean,
  p_wicket_type text,
  p_wicket_player_id uuid,
  p_fielder_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  perform public.process_ball(
    p_match_id,
    p_runs_bat,
    p_runs_extra,
    p_extra_type,
    (case when length(p_wicket_type) = 0 then null else p_wicket_type end)::public.wicket_type,
    p_wicket_player_id,
    p_fielder_id
  );
end;
$func$;

create or replace function public."rpc_undo_last_ball_atomic"(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  perform public.undo_last_ball(p_match_id);
end;
$func$;

create or replace function public."rpc_set_new_batter_atomic"(
  p_match_id uuid,
  p_new_player_id uuid,
  p_is_striker boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  perform public.set_new_batter(p_match_id, p_new_player_id, p_is_striker);
end;
$func$;

create or replace function public."rpc_set_new_bowler_atomic"(
  p_match_id uuid,
  p_new_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  perform public.set_new_bowler(p_match_id, p_new_player_id);
end;
$func$;

create or replace function public.rpc_start_second_innings(
  p_match_id uuid,
  p_opening_striker_id uuid,
  p_opening_non_striker_id uuid,
  p_opening_bowler_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  perform public.start_second_innings(
    p_match_id,
    p_opening_striker_id,
    p_opening_non_striker_id,
    p_opening_bowler_id
  );
end;
$func$;
