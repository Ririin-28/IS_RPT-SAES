import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";
import { useState } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";

interface AddTeacherModalProps {
  show: boolean;
  onClose: () => void;
  onAdd: (teacher: any) => void;
}

export default function AddTeacherModal({ show, onClose, onAdd }: AddTeacherModalProps) {
  const [formData, setFormData] = useState({
    teacherId: "",
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    grade: "",
    section: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.teacherId.trim()) newErrors.teacherId = "Teacher ID is required";
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.contactNumber.trim()) newErrors.contactNumber = "Contact number is required";
    if (!formData.grade) newErrors.grade = "Grade is required";
    if (!formData.section) newErrors.section = "Section is required";

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const newTeacher = {
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`,
        id: Date.now().toString()
      };
      onAdd(newTeacher);
      handleClose();
    }
  };

  const handleClose = () => {
    setFormData({
      teacherId: "",
      firstName: "",
      lastName: "",
      email: "",
      contactNumber: "",
      grade: "",
      section: ""
    });
    setErrors({});
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
        onClick={handleSubmit}>
        Save Teacher
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      show={show}
      onClose={handleClose}
      title="Add New Teacher"
      footer={footer}
    >
      <form id="add-teacher-form" onSubmit={handleSubmit} className="space-y-6">
        <ModalSection title="Personal Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Teacher ID</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="Enter teacher ID"
                name="teacherId"
                value={formData.teacherId}
                onChange={handleInputChange}
              />
              {errors.teacherId && <span className="text-red-500 text-xs">{errors.teacherId}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>First Name</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="Enter first name"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
              />
              {errors.firstName && <span className="text-red-500 text-xs">{errors.firstName}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Last Name</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="Enter last name"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
              />
              {errors.lastName && <span className="text-red-500 text-xs">{errors.lastName}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Email</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="Enter email address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
              />
              {errors.email && <span className="text-red-500 text-xs">{errors.email}</span>}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Contact Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Contact Number</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="0912-345-6789"
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleInputChange}
              />
              {errors.contactNumber && <span className="text-red-500 text-xs">{errors.contactNumber}</span>}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Teaching Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Grade</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                name="grade"
                value={formData.grade}
                onChange={handleInputChange}
              >
                <option value="" disabled>Select grade</option>
                {[1, 2, 3, 4, 5, 6].map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
              {errors.grade && <span className="text-red-500 text-xs">{errors.grade}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Section</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                name="section"
                value={formData.section}
                onChange={handleInputChange}
              >
                <option value="" disabled>Select section</option>
                {["A", "B", "C", "D", "E", "F"].map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
              {errors.section && <span className="text-red-500 text-xs">{errors.section}</span>}
            </div>
          </div>
        </ModalSection>
      </form>
    </BaseModal>
  );
}