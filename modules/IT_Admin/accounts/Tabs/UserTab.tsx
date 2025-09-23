import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from 'xlsx';
import AddUserModal from "../Modals/AddUserModal";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import BodyLabel from "@/components/Common/Texts/BodyLabel";

export default function UserTab() {
  const [users, setUsers] = useState([
    {
      id: 1,
      name: "John Doe",
      email: "john.doe@email.com",
      contact: "09123456789",
      role: "Admin",
      status: "Active"
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane.smith@email.com",
      contact: "09987654321",
      role: "Teacher",
      status: "Active"
    },
    {
      id: 3,
      name: "Peter Jones",
      email: "peter.jones@email.com",
      contact: "09111222333",
      role: "Parent",
      status: "Active"
    }
  ]);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // React Hook Form setup
  const formMethods = useForm({
    defaultValues: {
      userId: "",
      name: "",
      contact: "",
      role: "",
      email: "",
      status: "",
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = formMethods;

  // Add new user
  const onSubmit = (data: any) => {
    setUsers([
      ...users,
      {
        id: Date.now(),
        ...data,
      },
    ]);
    reset();
    setShowModal(false);
  };

  // Delete individual user
  const handleDelete = (id: number) => {
    setUsers(users.filter((u) => u.id !== id));
  };

  // Delete all users
  const handleDeleteAll = () => {
    setUsers([]);
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validTypes.includes(fileExtension)) {
      alert('Please upload only Excel files (.xlsx or .xls)');
      return;
    }

    setSelectedFile(file);
    setShowConfirmModal(true);
  };

  // Handle file upload confirmation
  const handleUploadConfirm = () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const newUsers = jsonData.map((row: any, index: number) => ({
          id: Date.now() + index,
          userId: row['User ID'] || row['userId'] || '',
          name: row['Name'] || row['name'] || '',
          contact: row['Contact No.'] || row['contact'] || row['contactNo'] || '',
          role: row['Role'] || row['role'] || '',
          email: row['Email'] || row['email'] || '',
          status: row['Status'] || row['status'] || '',
        }));

        setUsers([...users, ...newUsers]);
        alert(`Successfully imported ${newUsers.length} users`);
      } catch (error) {
        alert('Error reading Excel file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(selectedFile);
    setSelectedFile(null);
    setShowConfirmModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadCancel = () => {
    setSelectedFile(null);
    setShowConfirmModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      {/* Top Bar: Total and Actions */}
      <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 md:mb-2">
        <SecondaryHeader title="User List Table" />
        <div className="flex gap-2">
          <UtilityButton small onClick={() => setShowModal(true)}>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add</span>
            </span>
          </UtilityButton>
          <UtilityButton small onClick={() => fileInputRef.current?.click()}>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m17 8-5-5-5 5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              </svg>
              <span className="hidden sm:inline">Upload File</span>
            </span>
          </UtilityButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          {users.length > 0 && (
            <DangerButton small onClick={handleDeleteAll}>
              Delete All
            </DangerButton>
          )}
        </div>
      </div>
  <TertiaryHeader title={`Total: ${users.length}`} />
      {/* Add User Modal */}
      {/* You may want to update AddUserModal to use user fields, not teacher fields */}
      <AddUserModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
        }}
        form={formMethods}
        onSubmit={onSubmit}
      />

      {/* User Table Section */}
      <TableList
        columns={[ 
          { key: "no", title: "No#" },
          { key: "name", title: "Name" },
          { key: "email", title: "Email" },
          { key: "contact", title: "Contact No." },
          { key: "role", title: "Role" },
        ]}
        data={users.map((user, idx) => ({
          ...user,
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <>
            <DangerButton small onClick={() => {
              setUsers(users.map(u => u.id === row.id ? { ...u, status: u.status === "Active" ? "Disabled" : "Active" } : u));
            }}>
              {row.status === "Active" ? "Deactivate" : "Activate"}
            </DangerButton>
          </>
        )}
        pageSize={10}
      />
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleUploadCancel}
        onConfirm={handleUploadConfirm}
        title="Confirm File Upload"
        message="Are you sure you want to upload this Excel file? This will import user data."
        fileName={selectedFile?.name}
      />
    </div>
  );
}


