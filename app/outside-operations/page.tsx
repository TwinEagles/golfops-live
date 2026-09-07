import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import OperationsRefresh from "@/components/OperationsRefresh";
import { getGolfOpsAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
type StaffScheduleManagerProps={date:string;staff:Array<Record<string,unknown>>;tasks:Array<Record<string,unknown>>;isAdmin:boolean;latestImport:Record<string,unknown>|null};
function StaffScheduleManager({date,staff,tasks,latestImport}:StaffScheduleManagerProps){
 return <main className="mx-auto max-w-7xl space-y-6 p-6"><div><h1 className="text-2xl font-semibold">Outside Operations</h1><p className="text-sm opacity-70">{date}</p></div><section className="grid gap-6 lg:grid-cols-2"><div className="rounded-lg border border-black/10 bg-white/5 p-4"><h2 className="mb-3 font-semibold">Staff schedule</h2>{staff.length?<ul className="space-y-2">{staff.map((shift)=><li key={String(shift.id)} className="rounded border border-black/10 p-3"><strong>{String(shift.employee_name??"")}</strong>{shift.job_title?` · ${String(shift.job_title)}`:""}<div className="text-sm opacity-70">{String(shift.start_time??"")}–{String(shift.end_time??"")}{shift.zone?` · ${String(shift.zone)}`:""}</div></li>)}</ul>:<p className="text-sm opacity-70">No staff scheduled.</p>}</div><div className="rounded-lg border border-black/10 bg-white/5 p-4"><h2 className="mb-3 font-semibold">Tasks</h2>{tasks.length?<ul className="space-y-2">{tasks.map((task)=><li key={String(task.id)} className="rounded border border-black/10 p-3"><strong>{String(task.title??"")}</strong>{task.description?<div className="text-sm opacity-70">{String(task.description)}</div>:null}</li>)}</ul>:<p className="text-sm opacity-70">No tasks.</p>}{latestImport?<p className="mt-4 text-xs opacity-60">Last import: {String(latestImport.imported_at??"")}</p>:null}</div></section></main>;
}
export default async function OutsideOperationsPage({searchParams}:{searchParams:Promise<{date?:string}>}){
 const access=await getGolfOpsAccess(); if(!access)redirect('/'); if(!access.isAdmin&&!access.permissions.outside_operations)redirect('/settings/account');
 const requested=(await searchParams).date; const date=requested&&/^\d{4}-\d{2}-\d{2}$/.test(requested)?requested:today(); const db=await createClient();
 const [staffResult,tasksResult,importResult]=await Promise.all([
  db.from('schedulepop_shifts').select('id, employee_name, job_title, start_time, end_time, duty, zone, status, notes').eq('club_id',access.clubId).eq('shift_date',date).order('start_time'),
  db.from('staff_tasks').select('id,title,description,area,due_date,status').eq('club_id',access.clubId).order('status').order('due_date'),
  db.from('schedulepop_imports').select('imported_at,date_start,date_end,rows_imported').eq('club_id',access.clubId).order('imported_at',{ascending:false}).limit(1).maybeSingle(),
 ]);
 return <div className="min-h-screen bg-[var(--golfops-bg)] text-[var(--golfops-text)]"><OperationsRefresh/><AppNav active="outside-operations" selectedDate={date}/><StaffScheduleManager date={date} staff={staffResult.data??[]} tasks={tasksResult.data??[]} isAdmin={access.isAdmin} latestImport={importResult.data??null}/></div>;
}
