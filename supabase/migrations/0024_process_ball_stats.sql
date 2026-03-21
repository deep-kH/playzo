-- Update process_ball to compute and store calculated statistics
-- These statistics (crr, rrr, etc.) are computed by backend during ball processing
-- and stored in ls_match_state.stats for UI to read directly (no client-side calculations)

begin;

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
  v_match public.ls_matches%rowtype;
  v_seq integer;
  v_over smallint;
  v_ball smallint;
  v_is_legal boolean;
  v_total_runs integer;
  v_batting_row public.ls_batting_stats%rowtype;
  v_bowling_row public.ls_bowling_stats%rowtype;
  v_ball_id uuid;
  v_last_over_balls jsonb;
  v_stats jsonb;
  v_crr numeric;
  v_rrr numeric;
  v_projected_score integer;
  v_max_overs numeric;
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

  -- Fetch match metadata (needed for max_overs check)
  select *
  into v_match
  from public.ls_matches
  where id = p_match_id;

  v_max_overs := coalesce((v_match.settings->>'overs')::numeric, 20);

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

  -- =====================================
  -- ✅ COMPUTE STATISTICS FOR UI
  -- =====================================
  -- These values replace client-side calculations
  -- UI reads from state.stats, never computes locally

  -- CRR (Current Run Rate) = runs / overs
  if v_state.score_overs > 0 then
    v_crr := (v_state.score_runs::numeric / v_state.score_overs)::numeric(5,2);
  else
    v_crr := 0;
  end if;

  -- RRR (Required Run Rate) = (target - runs) / remaining_overs
  -- Only computed if there's a target (second innings)
  v_rrr := null;
  if v_state.target_score is not null and v_state.score_overs < v_max_overs then
    if (v_max_overs - v_state.score_overs) > 0 then
      v_rrr := ((v_state.target_score - v_state.score_runs)::numeric / (v_max_overs - v_state.score_overs))::numeric(5,2);
    else
      v_rrr := null;  -- no overs left
    end if;
  end if;

  -- Projected Score = (runs / overs) * max_overs
  -- Only for first innings, and only if >= 2 overs bowled
  v_projected_score := null;
  if v_innings.innings_number = 1 and v_state.score_overs >= 2 then
    v_projected_score := ((v_state.score_runs::numeric / v_state.score_overs) * v_max_overs)::integer;
  end if;

  -- Build stats JSONB
  v_stats := jsonb_build_object(
    'crr', v_crr,
    'rrr', v_rrr,
    'projected_score', v_projected_score,
    'partnership_runs', v_state.partnership_runs,
    'partnership_balls', v_state.partnership_balls
  );

  -- Update match_state with computed stats and enhanced snapshots
  -- bowler_snapshot includes computed economy for UI display
  update public.ls_match_state
  set striker_snapshot = to_jsonb(v_batting_row),
      bowler_snapshot = (
        to_jsonb(v_bowling_row) ||
        jsonb_build_object(
          'economy',
          case
            when v_bowling_row.overs > 0 then (v_bowling_row.runs_conceded::numeric / v_bowling_row.overs)::numeric(5,2)
            else 0
          end
        )
      ),
      stats = v_stats
  where match_id = p_match_id;
end;
$func$;

commit;
