-- Journey stickers are profile pictures. Remove the abandoned independent
-- equipment fields and keep ownership in unlocked_journey_rewards only.
alter table public.profiles
  drop column if exists equipped_sticker_id,
  drop column if exists equipped_banner_id;

-- Keep the two previously shipped avatar rewards useful if this migration is
-- applied after the original Journey migration.
update public.profiles
set unlocked_journey_rewards = array_append(unlocked_journey_rewards, 'sticker-8')
where 'avatar-eight' = any(coalesce(unlocked_journey_rewards, '{}'))
  and not ('sticker-8' = any(coalesce(unlocked_journey_rewards, '{}')));
update public.profiles
set unlocked_journey_rewards = array_append(unlocked_journey_rewards, 'sticker-11')
where 'avatar-eleven' = any(coalesce(unlocked_journey_rewards, '{}'))
  and not ('sticker-11' = any(coalesce(unlocked_journey_rewards, '{}')));
update public.profiles
set unlocked_journey_rewards = array_remove(array_remove(unlocked_journey_rewards, 'avatar-eight'), 'avatar-eleven')
where unlocked_journey_rewards && array['avatar-eight', 'avatar-eleven'];

-- Avatar One and Avatar Two were selectable before Journey existed. Grant their
-- matching stickers to those students so their active profile picture remains
-- selectable after the migration.
update public.profiles
set unlocked_journey_rewards = array_append(coalesce(unlocked_journey_rewards, '{}'), 'sticker-1')
where avatar_id = 'avatar-one' and not ('sticker-1' = any(coalesce(unlocked_journey_rewards, '{}')));
update public.profiles
set unlocked_journey_rewards = array_append(coalesce(unlocked_journey_rewards, '{}'), 'sticker-2')
where avatar_id = 'avatar-two' and not ('sticker-2' = any(coalesce(unlocked_journey_rewards, '{}')));

create or replace function public.claim_journey_reward(p_reward_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_level integer; v_unlocked text[]; v_required_level integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select level, unlocked_journey_rewards into v_level, v_unlocked from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profile not found'; end if;
  v_required_level := case p_reward_id
    when 'sticker-1' then 2 when 'sticker-2' then 4 when 'sticker-3' then 6
    when 'sticker-4' then 10 when 'sticker-5' then 14 when 'sticker-6' then 18
    when 'sticker-7' then 22 when 'sticker-8' then 26 when 'sticker-9' then 30
    when 'sticker-10' then 34 when 'sticker-11' then 38 when 'sticker-12' then 42
    else null end;
  if v_required_level is null then raise exception 'Unknown or free Journey sticker'; end if;
  if coalesce(v_level, 1) < v_required_level then raise exception 'This sticker is still locked'; end if;
  if p_reward_id = any(coalesce(v_unlocked, '{}')) then raise exception 'This sticker is already unlocked'; end if;
  perform set_config('app.claiming_journey_reward', 'true', true);
  update public.profiles set unlocked_journey_rewards = array_append(coalesce(v_unlocked, '{}'), p_reward_id)
    where id = auth.uid() returning unlocked_journey_rewards into strict v_unlocked;
  return jsonb_build_object('unlocked_journey_rewards', v_unlocked);
end;
$$;

create or replace function public.equip_journey_reward(p_reward_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_avatar_id text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  v_avatar_id := case p_reward_id
    when 'sticker-free' then 'default' when 'sticker-1' then 'avatar-one' when 'sticker-2' then 'avatar-two'
    when 'sticker-3' then 'avatar-three' when 'sticker-4' then 'avatar-four' when 'sticker-5' then 'avatar-five'
    when 'sticker-6' then 'avatar-six' when 'sticker-7' then 'avatar-seven' when 'sticker-8' then 'avatar-eight'
    when 'sticker-9' then 'avatar-nine' when 'sticker-10' then 'avatar-ten' when 'sticker-11' then 'avatar-eleven'
    when 'sticker-12' then 'avatar-twelve' else null end;
  if v_avatar_id is null then raise exception 'Unknown Journey sticker'; end if;
  if p_reward_id <> 'sticker-free' and not exists (
    select 1 from public.profiles where id = auth.uid() and p_reward_id = any(coalesce(unlocked_journey_rewards, '{}'))
  ) then raise exception 'Unlock this sticker before equipping it'; end if;
  update public.profiles set avatar_id = v_avatar_id where id = auth.uid();
  return (select jsonb_build_object('avatar_id', avatar_id) from public.profiles where id = auth.uid());
end;
$$;

create or replace function public.set_profile_avatar(p_avatar_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_reward_id text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  v_reward_id := case p_avatar_id
    when 'default' then 'sticker-free' when 'avatar-one' then 'sticker-1' when 'avatar-two' then 'sticker-2'
    when 'avatar-three' then 'sticker-3' when 'avatar-four' then 'sticker-4' when 'avatar-five' then 'sticker-5'
    when 'avatar-six' then 'sticker-6' when 'avatar-seven' then 'sticker-7' when 'avatar-eight' then 'sticker-8'
    when 'avatar-nine' then 'sticker-9' when 'avatar-ten' then 'sticker-10' when 'avatar-eleven' then 'sticker-11'
    when 'avatar-twelve' then 'sticker-12' else null end;
  if v_reward_id is null then raise exception 'Unknown profile sticker'; end if;
  if v_reward_id <> 'sticker-free' and not exists (
    select 1 from public.profiles where id = auth.uid() and v_reward_id = any(coalesce(unlocked_journey_rewards, '{}'))
  ) then raise exception 'This sticker is locked'; end if;
  update public.profiles set avatar_id = p_avatar_id where id = auth.uid();
  return jsonb_build_object('avatar_id', p_avatar_id);
end;
$$;

-- Enforce the same ownership rule even if a browser attempts a direct profiles
-- update rather than the RPC above.
create or replace function public.enforce_profile_sticker_ownership()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_reward_id text;
begin
  if new.avatar_id is not distinct from old.avatar_id then return new; end if;
  v_reward_id := case new.avatar_id
    when 'default' then 'sticker-free' when 'avatar-one' then 'sticker-1' when 'avatar-two' then 'sticker-2'
    when 'avatar-three' then 'sticker-3' when 'avatar-four' then 'sticker-4' when 'avatar-five' then 'sticker-5'
    when 'avatar-six' then 'sticker-6' when 'avatar-seven' then 'sticker-7' when 'avatar-eight' then 'sticker-8'
    when 'avatar-nine' then 'sticker-9' when 'avatar-ten' then 'sticker-10' when 'avatar-eleven' then 'sticker-11'
    when 'avatar-twelve' then 'sticker-12' else null end;
  if v_reward_id is null then raise exception 'Unknown profile sticker'; end if;
  if v_reward_id <> 'sticker-free' and not (v_reward_id = any(coalesce(new.unlocked_journey_rewards, '{}'))) then
    raise exception 'This sticker is locked';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_direct_journey_unlocks()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.unlocked_journey_rewards is distinct from old.unlocked_journey_rewards
    and current_setting('app.claiming_journey_reward', true) is distinct from 'true' then
    raise exception 'Journey stickers must be claimed through the Journey system';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_profile_sticker_ownership on public.profiles;
create trigger enforce_profile_sticker_ownership before update of avatar_id on public.profiles
for each row execute function public.enforce_profile_sticker_ownership();
drop trigger if exists prevent_direct_journey_unlocks on public.profiles;
create trigger prevent_direct_journey_unlocks before update of unlocked_journey_rewards on public.profiles
for each row execute function public.prevent_direct_journey_unlocks();

revoke all on function public.claim_journey_reward(text), public.equip_journey_reward(text), public.set_profile_avatar(text) from public;
grant execute on function public.claim_journey_reward(text), public.equip_journey_reward(text), public.set_profile_avatar(text) to authenticated;
