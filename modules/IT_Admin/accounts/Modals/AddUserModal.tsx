"use client";
import { UseFormReturn } from "react-hook-form";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

interface AddUserModalProps {
  show: boolean;
  onClose: () => void;
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void;
}

export default function AddUserModal({ show, onClose, form, onSubmit }: AddUserModalProps) {
  const { register, handleSubmit, formState: { errors } } = form;

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-4 text-green-900">Add New User</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">User ID</label>
            <input
              {...register("userId", { required: "User ID is required" })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter user ID"
            />
            {errors.userId && <span className="text-red-500 text-xs">{String(errors.userId.message)}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">Name</label>
            <input
              {...register("name", { required: "Name is required" })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter user name"
            />
            {errors.name && <span className="text-red-500 text-xs">{String(errors.name.message)}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">Contact No.</label>
            <input
              {...register("contact", { required: "Contact number is required" })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter contact number"
            />
            {errors.contact?.message && <span className="text-red-500 text-xs">{String(errors.contact.message)}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">Role</label>
            <select
              {...register("role", { required: "Role is required" })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select role</option>
              <option value="Admin">Admin</option>
              <option value="Teacher">Teacher</option>
              <option value="Parent">Parent</option>
              <option value="Principal">Principal</option>
            </select>
            {errors.role?.message && <span className="text-red-500 text-xs">{String(errors.role.message)}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">Email</label>
            <input
              {...register("email", { 
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Invalid email format"
                }
              })}
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter email address"
            />
            {errors.email?.message && <span className="text-red-500 text-xs">{String(errors.email.message)}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">Status</label>
            <select
              {...register("status", { required: "Status is required" })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select status</option>
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </select>
            {errors.status?.message && <span className="text-red-500 text-xs">{String(errors.status.message)}</span>}
          </div>
          <div className="flex gap-2 pt-4">
            <PrimaryButton type="submit" className="flex-1">Add User</PrimaryButton>
            <SecondaryButton type="button" onClick={onClose} className="flex-1">Cancel</SecondaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}