import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

interface Activity {
  id: number;
  title: string;
  roomNo: string;
  description?: string;
  date: Date;
  end: Date;
  type: string;
}

interface ActivityDetailModalProps {
  activity: Activity | null;
  onClose: () => void;
  onDelete?: (id: number) => void;
}

export default function ActivityDetailModal({ activity, onClose, onDelete }: ActivityDetailModalProps) {
  if (!activity) return null;
  
  return (
    <div className="fixed inset-0 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[95vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <SecondaryHeader title="Activity Details" />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Title*</label>
            <div className="text-black">{activity.title}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <div className="text-black">
              {activity.date.toLocaleDateString()}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <div className="text-black">{activity.roomNo}</div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-2">
          <DangerButton 
            type="button" 
            onClick={() => onDelete && onDelete(activity.id)} 
            className="px-5 py-2.5"
          >
            Delete
          </DangerButton>
          <SecondaryButton 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2.5"
          >
            Close
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}