import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import OperationsRefresh from "@/components/OperationsRefresh";
import StaffScheduleManager from "@/components/StaffScheduleManager";
import { getGolfOpsAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
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
