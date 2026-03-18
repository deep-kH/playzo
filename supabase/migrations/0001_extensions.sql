begin;

create extension if not exists pgcrypto;

-- Useful for unaccent/fts etc later; harmless if present.
create extension if not exists citext;

commit;
