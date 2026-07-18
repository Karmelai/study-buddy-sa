import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Send } from "lucide-react";
import AppShell from "@/components/AppShell";
import { callAI, type ChatMessage } from "@/lib/ai";
import { supabase } from "@/lib/supabase";
import { useKarmelStore } from "@/store/useKarmelStore";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Smart Calendar - KARMEL" }] }),
  component: SmartCalendar,
});

type CalendarEvent = {
  id: string;
  title: string;
  subject?: string;
  description?: string;
  kind: "session" | "deadline" | "reminder";
  date: string;
  startsAt: string;
  endsAt?: string;
  durationMinutes?: number;
};
type PlannerReply = {
  action?: "create" | "delete";
  status?: "needs_details" | "ready";
  message?: string;
  event?: Omit<CalendarEvent, "id"> | null;
  eventId?: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthFormatter = new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long" });
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromDateKey = (value: string) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); };
const formatTime = (time: string) => new Intl.DateTimeFormat("en-ZA", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, ...time.split(":").map(Number)));
const timeKey = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const localDateTimeToIso = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();

type CalendarEventRow = { id: string; title: string; description: string | null; start_time: string; end_time: string; all_day: boolean; color: string | null };
const toCalendarEvent = (row: CalendarEventRow): CalendarEvent => {
  const start = new Date(row.start_time);
  const end = new Date(row.end_time);
  return { id: row.id, title: row.title, description: row.description ?? undefined, kind: "reminder", date: dateKey(start), startsAt: timeKey(start), endsAt: row.all_day ? undefined : timeKey(end) };
};

const extractJson = (value: string): PlannerReply | null => {
  const candidate = value.replace(/```json|```/g, "").match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) return null;
  try { return JSON.parse(candidate) as PlannerReply; } catch { return null; }
};

function SmartCalendar() {
  const studentName = useKarmelStore((state) => state.studentName);
  const userId = useKarmelStore((state) => state.userId);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [plannerInput, setPlannerInput] = useState("");
  const [plannerReply, setPlannerReply] = useState("Tell me what you would like to schedule, and I’ll ask for anything missing.");
  const [plannerMessages, setPlannerMessages] = useState<ChatMessage[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setEvents([]);
      return;
    }
    let active = true;
    setCalendarError(null);
    void supabase.from("calendar_events").select("id, title, description, start_time, end_time, all_day, color").eq("user_id", userId).order("start_time", { ascending: true }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setCalendarError(`Your calendar events could not be loaded: ${error.message}`);
        return;
      }
      setEvents((data ?? []).map((row) => toCalendarEvent(row as CalendarEventRow)));
    });
    return () => { active = false; };
  }, [userId]);

  const days = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const numberOfDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    return Array.from({ length: firstDay.getDay() + numberOfDays }, (_, index) => index < firstDay.getDay() ? null : new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index - firstDay.getDay() + 1));
  }, [currentMonth]);
  const eventsByDate = useMemo(() => events.reduce<Record<string, CalendarEvent[]>>((grouped, event) => {
    (grouped[event.date] ??= []).push(event);
    grouped[event.date].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
    return grouped;
  }, {}), [events]);
  const selectedEvents = eventsByDate[selectedDate] ?? [];

  const planEvent = async () => {
    const request = plannerInput.trim();
    if (!request || isPlanning) return;
    const scheduledEvents = events.map(({ id, title, subject, description, kind, date, startsAt, endsAt }) => ({ id, title, subject, description, kind, date, startsAt, endsAt }));
    const systemMessage: ChatMessage = { role: "system", content: `You are KARMEL's Smart Calendar planner. Today is ${dateKey(new Date())}. Help ${studentName} create or remove one calendar event. Events can be a session, deadline, or reminder; they do not need to be study-related. Existing events are: ${JSON.stringify(scheduledEvents)}. Create concise, natural titles and preserve useful details in description. A session is a time block and needs exact date, start time, and duration or end time. Never infer, guess, or choose a session duration. A deadline or reminder is a point-in-time event and only needs a title, exact date, and time; do not ask for duration. Example: "Programming project due Sunday 19 July at midnight" is a deadline with title "Programming project due", startsAt "00:00", and no end time. Example: "Gym with Alex from 8 to 10" is a session with title "Gym session", description "Gym session with Alex", and endsAt "10:00". For removing an event, identify one exact matching event from Existing events and return its id. Never delete more than one event. If no exact event can be identified, ask a concise clarifying question. Return ONLY valid JSON. For missing or ambiguous details: {"action":"create" or "delete","status":"needs_details","message":"one concise question","event":null}. For a completed create: {"action":"create","status":"ready","message":"short confirmation","event":{"title":"string","subject":"string or empty","description":"string or empty","kind":"session" or "deadline" or "reminder","date":"YYYY-MM-DD","startsAt":"HH:MM","endsAt":"HH:MM or empty","durationMinutes":number or null}}. For a completed delete: {"action":"delete","status":"ready","message":"short confirmation","event":null,"eventId":"exact existing id"}. Use local time and never invent an ambiguous date.` };
    const userMessage: ChatMessage = { role: "user", content: request };
    const nextMessages = [...plannerMessages, userMessage];
    setPlannerInput("");
    setIsPlanning(true);
    try {
      const reply = extractJson(await callAI([systemMessage, ...nextMessages], studentName, "calendar"));
      if (!reply?.message) throw new Error("I couldn't understand that scheduling request. Please include a subject, date, time, and duration.");
      const isPointInTimeEvent = reply.event?.kind === "deadline" || reply.event?.kind === "reminder";
      const hasSessionTime = Boolean(reply.event?.endsAt) || (Number.isFinite(reply.event?.durationMinutes) && (reply.event?.durationMinutes ?? 0) > 0);
      const hasCompleteEvent = reply.status === "ready" && reply.action !== "delete" && reply.event?.title && reply.event.date && reply.event.startsAt && reply.event.kind && (isPointInTimeEvent || hasSessionTime);
      const eventToDelete = reply.status === "ready" && reply.action === "delete" ? events.find((event) => event.id === reply.eventId) : undefined;
      const responseMessage = eventToDelete
        ? reply.message
        : reply.status === "ready" && reply.action === "delete"
          ? "Which scheduled event would you like me to remove?"
          : reply.status === "ready" && !hasCompleteEvent
            ? "Is this a deadline/reminder, or a session with a duration?"
            : reply.message;
      setPlannerMessages([...nextMessages, { role: "assistant", content: responseMessage }]);
      setPlannerReply(responseMessage);
      if (hasCompleteEvent) {
        if (!userId) throw new Error("Please sign in again before saving a calendar event.");
        const startTime = localDateTimeToIso(reply.event.date, reply.event.startsAt);
        const endTime = reply.event.endsAt
          ? localDateTimeToIso(reply.event.date, reply.event.endsAt)
          : new Date(new Date(startTime).getTime() + 60 * 1000).toISOString();
        const { data, error: saveError } = await supabase
          .from("calendar_events")
          .insert({ user_id: userId, title: reply.event.title, description: reply.event.description || null, start_time: startTime, end_time: endTime, all_day: false, color: null })
          .select("id, title, description, start_time, end_time, all_day, color")
          .single();
        if (saveError) throw new Error(`Your event could not be saved: ${saveError.message}`);
        const event = toCalendarEvent(data as CalendarEventRow);
        setEvents((current) => [...current, event]);
        setSelectedDate(event.date);
        const eventDate = fromDateKey(event.date);
        setCurrentMonth(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
        setPlannerMessages([]);
      }
      if (eventToDelete) {
        const { error: deleteError } = await supabase.from("calendar_events").delete().eq("id", eventToDelete.id).eq("user_id", userId);
        if (deleteError) throw new Error(`Your event could not be deleted: ${deleteError.message}`);
        setEvents((current) => current.filter((event) => event.id !== eventToDelete.id));
        setPlannerMessages([]);
      }
    } catch (error) { setPlannerReply(error instanceof Error ? error.message : "I couldn't schedule that yet. Please try again."); }
    finally { setIsPlanning(false); }
  };

  return <AppShell><div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <section className="mx-auto max-w-3xl text-center"><h1 className="text-3xl font-semibold sm:text-4xl">Plan your time, naturally.</h1><p className="mt-3 text-sm leading-6 text-white/55">Try: “Schedule a gym session with Alex this Friday from 8:00 to 10:00,” or “My programming project is due this Sunday at midnight.”</p></section>
    <section className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-3 shadow-xl shadow-black/10 sm:p-4"><div className="flex items-center gap-3"><input value={plannerInput} onChange={(event) => setPlannerInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void planEvent(); }} placeholder="Ask KARMEL to schedule something…" className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/35" /><button type="button" onClick={() => void planEvent()} disabled={!plannerInput.trim() || isPlanning} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:opacity-40" aria-label="Ask KARMEL to schedule an event"><Send size={16} /></button></div><p className="px-1 pt-3 text-xs leading-5 text-white/55">{isPlanning ? "KARMEL is planning your event…" : plannerReply}</p></section>
    <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/10 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarDays size={18} className="text-primary" /><h2 className="text-lg font-medium">{monthFormatter.format(currentMonth)}</h2></div><div className="flex items-center gap-1"><button type="button" onClick={() => setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/75 transition hover:bg-white/10" aria-label="Previous month"><ChevronLeft size={17} /></button><button type="button" onClick={() => setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/75 transition hover:bg-white/10" aria-label="Next month"><ChevronRight size={17} /></button></div></div><div className="mt-6 grid grid-cols-7 gap-1.5 text-center sm:gap-2">{WEEKDAYS.map((day) => <p key={day} className="pb-1 text-[10px] font-medium uppercase tracking-wider text-white/35 sm:text-xs">{day}</p>)}{days.map((date, index) => {
      if (!date) return <div key={`empty-${index}`} />;
      const key = dateKey(date); const dayEvents = eventsByDate[key] ?? []; const isSelected = key === selectedDate; const isToday = key === dateKey(new Date());
      return <div key={key} className="group relative min-h-20 sm:min-h-24"><button type="button" onClick={() => setSelectedDate(key)} className={`flex h-full w-full flex-col rounded-2xl border p-2 text-left transition sm:p-2.5 ${dayEvents.length ? "border-primary/50 bg-primary/10 hover:bg-primary/15" : "border-white/5 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.06]"} ${isSelected ? "ring-2 ring-primary/70" : ""}`}><span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-medium ${isToday ? "bg-white text-black" : "text-white/75"}`}>{date.getDate()}</span><div className="mt-1.5 space-y-1 overflow-hidden">{dayEvents.slice(0, 2).map((event) => <p key={event.id} className="truncate rounded-md bg-black/15 px-1 py-0.5 text-[9px] text-white/85 sm:text-[10px]"><span className="text-white/50">{formatTime(event.startsAt)}</span> {event.title}</p>)}{dayEvents.length > 2 && <p className="text-[10px] text-white/50">+{dayEvents.length - 2} more</p>}</div></button>{dayEvents.length > 0 && <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-52 -translate-x-1/2 rounded-xl border border-white/10 bg-popover p-3 text-left shadow-xl group-hover:block"><p className="text-xs font-medium">{dayFormatter.format(date)}</p><div className="mt-2 space-y-1.5">{dayEvents.slice(0, 2).map((event) => <p key={event.id} className="text-xs text-white/65"><span className="text-white">{formatTime(event.startsAt)}{event.endsAt ? `–${formatTime(event.endsAt)}` : ""}</span> · {event.title}</p>)}</div></div>}</div>;
    })}</div></div>
      <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs uppercase tracking-[0.2em] text-white/40">Day plan</p><h2 className="mt-2 text-lg font-medium">{dayFormatter.format(fromDateKey(selectedDate))}</h2>{selectedEvents.length ? <div className="mt-5 space-y-3">{selectedEvents.map((event) => <div key={event.id} className="rounded-2xl border border-primary/20 bg-primary/10 p-3"><p className="font-medium text-white">{event.title}</p>{event.subject && <p className="mt-1 text-xs text-white/55">{event.subject}</p>}{event.description && <p className="mt-2 text-xs leading-5 text-white/65">{event.description}</p>}<p className="mt-3 flex items-center gap-1.5 text-xs text-white/70"><Clock3 size={13} />{formatTime(event.startsAt)}{event.endsAt ? ` – ${formatTime(event.endsAt)}` : ""}</p></div>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-4 text-sm leading-6 text-white/45">Nothing planned yet. Ask KARMEL to add an event for this day.</div>}</aside></section>
  </div></AppShell>;
}
