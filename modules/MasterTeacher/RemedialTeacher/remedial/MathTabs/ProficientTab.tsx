"use client";
import { useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";

export default function ProficientTab() {
  const [remedials,setRemedials]=useState<any[]>([]);
  const handleDelete=(id:number)=>setRemedials(remedials.filter(r=>r.id!==id));
  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 md:mb-2">
        <p className="text-gray-600 text-md font-medium">Total: {remedials.length}</p>
      </div>
      <TableList columns={[{key:"no",title:"No#"},{key:"title",title:"Title"},{key:"dateToUse",title:"Date to use"},{key:"status",title:"Status"}]}
        data={remedials.map((r,idx)=>({...r,no:idx+1}))}
        actions={(row:any)=>(<><UtilityButton small>See All</UtilityButton><DangerButton small onClick={()=>handleDelete(row.id)}>Delete</DangerButton></>)} pageSize={10}/>
    </div>
  );
}
