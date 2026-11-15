export type UserRole = 'buyer' | 'agent';
export type KycStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';
export type AgentUpgradeStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type HouseStatus = 'Available' | 'SOLD OUT';
export type HouseApprovalStatus = 'pending' | 'approved' | 'rejected';

export type HouseType =
  | 'Single Room'
  | 'Self-Contain'
  | '1 Bedroom'
  | '2 Bedroom'
  | '3 Bedroom'
  | 'Duplex'
  | 'Shop';

export type HomePropertyCategory =
  | 'TV & Electronics'
  | 'Gas Cooker & Cylinder'
  | 'Fan & AC'
  | 'Refrigerator & Freezer'
  | 'Furniture & Bed'
  | 'Generator & Solar'
  | 'Kitchen Appliances'
  | 'Other Home Property';

export type HomePropertyCondition = 'Brand New' | 'Neatly Used' | 'Fairly Used';

export interface AuthUser {
  id: string;
  userCode: string;
  fullName: string;
  phone: string;
  email: string;
  state: string;
  role: UserRole;
  isVerified: boolean;
  isBlocked: boolean;
  kycStatus: KycStatus;
  kycRejectionReason?: string | null;
  agentUpgradeStatus?: AgentUpgradeStatus;
  agentUpgradeReason?: string | null;
  isAdmin?: boolean;
  createdAt: string;
}

export interface AgentUpgradeRequest {
  id: string;
  userId: string;
  userCode: string;
  userFullName: string;
  userEmail: string;
  userPhone: string;
  userState: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HomePropertyItem {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerCode?: string;
  title: string;
  category: HomePropertyCategory;
  condition: HomePropertyCondition;
  price: number;
  area: string;
  state: string;
  country: string;
  phone: string;
  images: string[];
  description: string;
  status: 'Available' | 'SOLD';
  approvalStatus: HouseApprovalStatus;
  rejectionReason?: string | null;
  createdAt: string;
}

export interface KycSubmission {
  id: string;
  userId: string;
  userCode?: string;
  userFullName?: string;
  userEmail?: string;
  userPhone?: string;
  userState?: string;
  idType: 'NIN' | 'BVN';
  idNumber: string;
  idCardUrl?: string | null;
  selfieUrl: string;
  livenessVideoUrl?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HouseListing {
  id: string;
  agentId: string;
  agentCode?: string;
  agentName: string;
  agentVerified: boolean;
  title: string;
  houseNumber: string;
  streetName: string;
  area: string;
  state: string;
  country: string;
  price: number;
  inspectionFee: number;
  houseType: HouseType;
  phone: string;
  images: string[];
  amenities: string[];
  description: string;
  status: HouseStatus;
  approvalStatus: HouseApprovalStatus;
  rejectionReason?: string | null;
  lat?: number | null;
  lng?: number | null;
  distanceKm?: number | null;
  createdAt: string;
}

export interface RouteResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationText: string;
  encodedPolyline: string;
}

export interface InspectionBooking {
  id: string;
  houseId: string;
  houseTitle?: string;
  houseLocation?: string;
  userId?: string | null;
  buyerName: string;
  buyerPhone: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
  status?: string;
  createdAt: string;
}

export interface AdminNote {
  id: string;
  message: string;
  createdAt: string;
}

export interface LoginLogEntry {
  id: string;
  userId: string;
  userCode: string;
  fullName: string;
  email: string;
  role: UserRole;
  loggedInAt: string;
}

export interface UserReport {
  id: string;
  reportedUid: string;
  reportedUserId: string | null;
  reportedUserName: string;
  reportedUserEmail: string;
  reportedUserPhone: string;
  reportedUserRole: string;
  reportedUserBlocked: boolean;
  reporterName: string;
  reporterContact: string;
  listingType: 'general' | 'house' | 'item';
  listingId: string;
  reason: string;
  status: 'open' | 'warned' | 'resolved';
  adminActionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDashboardData {
  stats: {
    totalHouses: number;
    pendingHouses: number;
    totalUsers: number;
    totalAgents: number;
    pendingKyc: number;
    pendingUpgrades: number;
    totalItems: number;
    totalBookings: number;
    openReports?: number;
  };
  users: AuthUser[];
  kycRequests: KycSubmission[];
  upgradeRequests: AgentUpgradeRequest[];
  houses: HouseListing[];
  bookings: InspectionBooking[];
  homeItems: HomePropertyItem[];
  reports?: UserReport[];
  notes: AdminNote[];
  loginLogs: LoginLogEntry[];
}
