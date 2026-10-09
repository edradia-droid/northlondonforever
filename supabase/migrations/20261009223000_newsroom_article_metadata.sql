-- Add editorial metadata for NL4's original newsroom articles.
-- Existing articles keep their current publication status and receive safe defaults.
alter table public.news
  add column if not exists category text not null default 'Arsenal News',
  add column if not exists author text not null default 'NL4 Editorial Team',
  add column if not exists sources text;

update public.news
set category = 'Arsenal News'
where category is null or btrim(category) = '';

update public.news
set author = 'NL4 Editorial Team'
where author is null or btrim(author) = '';
