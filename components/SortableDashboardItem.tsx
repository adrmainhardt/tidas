import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableDashboardItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

const SortableDashboardItem: React.FC<SortableDashboardItemProps> = ({ id, children, className = "" }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab'
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`h-full ${className}`}
    >
      {children}
    </div>
  );
};

export default SortableDashboardItem;
