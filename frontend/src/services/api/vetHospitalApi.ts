import apiClient from './client';
import type {
  VetHospital, HospitalDepartment, HospitalDoctor, HospitalService,
  HospitalStats, HospitalAdminStats, CreateHospitalData, HospitalDocument,
  DocType, VerificationStatus,
} from '../../types';

export const vetHospitalApi = {
  // ─── Hospital CRUD ──────────────────────────────────────────
  createHospital: async (data: CreateHospitalData): Promise<VetHospital> => {
    const res = await apiClient.post('/vet-hospitals', data);
    return res.data.data;
  },

  listHospitals: async (params?: {
    search?: string; city?: string; hospitalType?: string; specialization?: string;
    hasEmergency?: boolean; is24Hours?: boolean; isVerified?: boolean;
    limit?: number; offset?: number;
  }): Promise<{ hospitals: VetHospital[]; total: number }> => {
    const res = await apiClient.get('/vet-hospitals', { params });
    return res.data.data;
  },

  listMyHospitals: async (): Promise<VetHospital[]> => {
    const res = await apiClient.get('/vet-hospitals/my');
    return res.data.data;
  },

  getHospital: async (id: string): Promise<VetHospital> => {
    const res = await apiClient.get(`/vet-hospitals/${id}`);
    return res.data.data;
  },

  updateHospital: async (id: string, data: Partial<CreateHospitalData>): Promise<VetHospital> => {
    const res = await apiClient.put(`/vet-hospitals/${id}`, data);
    return res.data.data;
  },

  deleteHospital: async (id: string): Promise<void> => {
    await apiClient.delete(`/vet-hospitals/${id}`);
  },

  verifyHospital: async (id: string, verified: boolean): Promise<VetHospital> => {
    const res = await apiClient.put(`/vet-hospitals/${id}/verify`, { verified });
    return res.data.data;
  },

  getHospitalStats: async (id: string): Promise<HospitalStats> => {
    const res = await apiClient.get(`/vet-hospitals/${id}/stats`);
    return res.data.data;
  },

  getAdminStats: async (): Promise<HospitalAdminStats> => {
    const res = await apiClient.get('/vet-hospitals/admin/stats');
    return res.data.data;
  },

  // ─── Doctors ───────────────────────────────────────────────
  listDoctors: async (hospitalId: string): Promise<HospitalDoctor[]> => {
    const res = await apiClient.get(`/vet-hospitals/${hospitalId}/doctors`);
    return res.data.data;
  },

  addDoctor: async (hospitalId: string, data: {
    doctorId: string; departmentId?: string; hospitalRole?: string; title?: string;
    employmentType?: string; isPrimaryHospital?: boolean; consultationFee?: number;
  }): Promise<HospitalDoctor> => {
    const res = await apiClient.post(`/vet-hospitals/${hospitalId}/doctors`, data);
    return res.data.data;
  },

  updateDoctor: async (hospitalId: string, doctorId: string, data: {
    hospitalRole?: string; title?: string; departmentId?: string;
    employmentType?: string; isPrimaryHospital?: boolean;
    consultationFee?: number; isAcceptingPatients?: boolean;
  }): Promise<HospitalDoctor> => {
    const res = await apiClient.put(`/vet-hospitals/${hospitalId}/doctors/${doctorId}`, data);
    return res.data.data;
  },

  removeDoctor: async (hospitalId: string, doctorId: string): Promise<void> => {
    await apiClient.delete(`/vet-hospitals/${hospitalId}/doctors/${doctorId}`);
  },

  // ─── Departments ───────────────────────────────────────────
  listDepartments: async (hospitalId: string): Promise<HospitalDepartment[]> => {
    const res = await apiClient.get(`/vet-hospitals/${hospitalId}/departments`);
    return res.data.data;
  },

  createDepartment: async (hospitalId: string, data: {
    name: string; code?: string; description?: string; specializations?: string[];
    floorNumber?: string; roomNumbers?: string; headDoctorId?: string;
  }): Promise<HospitalDepartment> => {
    const res = await apiClient.post(`/vet-hospitals/${hospitalId}/departments`, data);
    return res.data.data;
  },

  updateDepartment: async (hospitalId: string, deptId: string, data: Partial<{
    name: string; code: string; description: string; specializations: string[];
    floorNumber: string; roomNumbers: string; headDoctorId: string;
  }>): Promise<HospitalDepartment> => {
    const res = await apiClient.put(`/vet-hospitals/${hospitalId}/departments/${deptId}`, data);
    return res.data.data;
  },

  deleteDepartment: async (hospitalId: string, deptId: string): Promise<void> => {
    await apiClient.delete(`/vet-hospitals/${hospitalId}/departments/${deptId}`);
  },

  // ─── Services ─────────────────────────────────────────────
  listServices: async (hospitalId: string): Promise<HospitalService[]> => {
    const res = await apiClient.get(`/vet-hospitals/${hospitalId}/services`);
    return res.data.data;
  },

  addService: async (hospitalId: string, data: {
    serviceName: string; category: string; description?: string;
    priceMin?: number; priceMax?: number; currency?: string;
    durationMinutes?: number; requiresAppointment?: boolean;
  }): Promise<HospitalService> => {
    const res = await apiClient.post(`/vet-hospitals/${hospitalId}/services`, data);
    return res.data.data;
  },

  updateService: async (hospitalId: string, serviceId: string, data: Partial<{
    serviceName: string; category: string; description: string;
    priceMin: number; priceMax: number; currency: string;
    durationMinutes: number; requiresAppointment: boolean; isAvailable: boolean;
  }>): Promise<HospitalService> => {
    const res = await apiClient.put(`/vet-hospitals/${hospitalId}/services/${serviceId}`, data);
    return res.data.data;
  },

  deleteService: async (hospitalId: string, serviceId: string): Promise<void> => {
    await apiClient.delete(`/vet-hospitals/${hospitalId}/services/${serviceId}`);
  },

  // ─── Documents (KYC / Compliance) ─────────────────────────
  listDocuments: async (hospitalId: string): Promise<HospitalDocument[]> => {
    const res = await apiClient.get(`/vet-hospitals/${hospitalId}/documents`);
    return res.data.data;
  },

  /** Upload a document by passing a pre-uploaded fileUrl or let the caller use FormData */
  uploadDocument: async (
    hospitalId: string,
    formData: FormData,
  ): Promise<HospitalDocument> => {
    const res = await apiClient.post(`/vet-hospitals/${hospitalId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  /** Upload doc using a pre-uploaded URL (from /api/files/upload) */
  uploadDocumentByUrl: async (
    hospitalId: string,
    payload: { docType: DocType; fileUrl: string; fileName: string; expiryDate?: string },
  ): Promise<HospitalDocument> => {
    const res = await apiClient.post(`/vet-hospitals/${hospitalId}/documents`, payload);
    return res.data.data;
  },

  /** Admin: approve or reject a document */
  reviewDocument: async (
    hospitalId: string,
    docId: string,
    payload: { status: 'approved' | 'rejected'; rejectionReason?: string },
  ): Promise<HospitalDocument> => {
    const res = await apiClient.put(
      `/vet-hospitals/${hospitalId}/documents/${docId}/review`,
      payload,
    );
    return res.data.data;
  },

  /** Admin: list hospitals pending verification */
  listPendingVerification: async (params?: {
    status?: VerificationStatus; limit?: number; offset?: number;
  }): Promise<{ hospitals: any[]; total: number }> => {
    const res = await apiClient.get('/vet-hospitals/admin/pending', { params });
    return res.data.data;
  },
};

export default vetHospitalApi;
