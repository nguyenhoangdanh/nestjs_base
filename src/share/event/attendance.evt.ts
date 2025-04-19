import { AppEvent } from '../data-model';

export const EvtAttendanceUpdated = 'AttendanceUpdated';
export const EvtLeaveRequested = 'LeaveRequested';
export const EvtLeaveApproved = 'LeaveApproved';
export const EvtLeaveRejected = 'LeaveRejected';
export const EvtProductionRecordCreated = 'ProductionRecordCreated';
export const EvtProductionRecordApproved = 'ProductionRecordApproved';
export const EvtApprovalRequested = 'ApprovalRequested';
export const EvtApprovalCompleted = 'ApprovalCompleted';

export type AttendanceEventPayload = {
  userId: string;
  date: string;
  shift: string;
  status: string;
};

export class AttendanceEvent<
  T extends AttendanceEventPayload,
> extends AppEvent<T> {
  // Triển khai tương tự như PostEvent
}

// Tương tự cho các event khác
