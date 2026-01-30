 "use client";
 
 import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
 
 type NoFlashcardsModalProps = {
   isOpen: boolean;
   onClose: () => void;
 };
 
 export default function NoFlashcardsModal({ isOpen, onClose }: NoFlashcardsModalProps) {
   return (
     <ConfirmationModal
       isOpen={isOpen}
       onClose={onClose}
       onConfirm={onClose}
       title="No Extracted Flashcards Found"
       message="No extracted flashcards are available for this activity."
     />
   );
 }
