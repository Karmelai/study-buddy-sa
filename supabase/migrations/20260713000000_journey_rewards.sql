-- Journey cosmetics are account-owned profile data.  The RPCs below deliberately
-- use the stored profile level instead of any value submitted by the browser.
alter table public.profiles
  add column if not exists unlocked_journey_rewards text[] not null default '{}',
  add column if not exists equipped_sticker_id text,
  add column if not exists equipped_banner_id text;

create or replace function public.claim_journey_reward(p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level integer;
  v_unlocked text[];
  v_required_level integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select level, unlocked_journey_rewards into v_level, v_unlocked
  from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profile not found'; end if;

  v_required_level := case p_reward_id
    when 'avatar-eight' then 2
    when 'sticker-spark' then 4
    when 'banner-dawn' then 6
    when 'avatar-eleven' then 10
    when 'sticker-comet' then 14
    when 'banner-aurora' then 18
    else null
  end;
  if v_required_level is null then raise exception 'Unknown Journey reward'; end if;
  if coalesce(v_level, 1) < v_required_level then raise exception 'This reward is still locked'; end if;
  if p_reward_id = any(coalesce(v_unlocked, '{}')) then raise exception 'This reward is already unlocked'; end if;

  update public.profiles
  set unlocked_journey_rewards = array_append(coalesce(v_unlocked, '{}'), p_reward_id)
  where id = auth.uid()
  returning unlocked_journey_rewards into strict v_unlocked;

  return jsonb_build_object('unlocked_journey_rewards', v_unlocked);
end;
$$;

create or replace function public.equip_journey_reward(p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unlocked text[];
  v_type text;
  v_avatar_id text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select unlocked_journey_rewards into v_unlocked from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profile not found'; end if;
  if not (p_reward_id = any(coalesce(v_unlocked, '{}'))) then raise exception 'Unlock this reward before equipping it'; end if;

  select reward_type, avatar_id into v_type, v_avatar_id from (values
    ('avatar-eight'::text, 'avatar'::text, 'avatar-eight'::text),
    ('sticker-spark', 'sticker', null::text),
    ('banner-dawn', 'banner', null::text),
    ('avatar-eleven', 'avatar', 'avatar-eleven'),
    ('sticker-comet', 'sticker', null::text),
    ('banner-aurora', 'banner', null::text)
  ) as rewards(id, reward_type, avatar_id) where id = p_reward_id;
  if v_type is null then raise exception 'Unknown Journey reward'; end if;

  if v_type = 'avatar' then
    update public.profiles set avatar_id = v_avatar_id where id = auth.uid();
  elsif v_type = 'sticker' then
    update public.profiles set equipped_sticker_id = p_reward_id where id = auth.uid();
  else
    update public.profiles set equipped_banner_id = p_reward_id where id = auth.uid();
  end if;

  return (select jsonb_build_object('avatar_id', avatar_id, 'equipped_sticker_id', equipped_sticker_id, 'equipped_banner_id', equipped_banner_id) from public.profiles where id = auth.uid());
end;
$$;

revoke all on function public.claim_journey_reward(text) from public;
revoke all on function public.equip_journey_reward(text) from public;
grant execute on function public.claim_journey_reward(text) to authenticated;
grant execute on function public.equip_journey_reward(text) to authenticated;
