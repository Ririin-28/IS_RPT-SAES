import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";
import { useState } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";

interface AddScheduleModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (schedule: any) => void;
}

export default function AddScheduleModal({ show, onClose, onSave }: AddScheduleModalProps) {
  const [formData, setFormData] = useState({
    title: "1st Quarter",
    startDate: "",
    endDate: ""
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.startDate || !formData.endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setError("End date cannot be before start date.");
      return;
    }
    const schedule = {
      id: Date.now(),
      title: formData.title,
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
      isActive: false
    };
    onSave(schedule);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      title: "1st Quarter",
      startDate: "",
      endDate: ""
    });
    onClose();
  };

  const footer = (
    <>
      <DangerButton
        type="button"
        onClick={handleClose}>
        Cancel
      </DangerButton>
      <PrimaryButton
  type="submit"
  form="schedule-form">
        Add Schedule
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      show={show}
      onClose={handleClose}
      title="Add New Schedule"
      maxWidth="md"
      footer={footer}
    >
      <form id="schedule-form" onSubmit={handleSubmit} className="space-y-6">
        <ModalSection title="Schedule Details">
          <div className="space-y-4">
            <div className="space-y-1">
              <ModalLabel required>Title</ModalLabel>
              <select
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                required
              >
                <option value="1st Quarter">1st Quarter</option>
                <option value="2nd Quarter">2nd Quarter</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <ModalLabel required>Start</ModalLabel>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <ModalLabel required>End</ModalLabel>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </ModalSection>
      </form>
    </BaseModal>
  );
}