export interface UserProfile {
  id: string; email: string; display_name: string;
  role: 'superadmin'|'admin'|'supervisor'|'operator'|'viewer';
  company_id?: string; shift?: string; sector?: string; blocked?: boolean;
}
export interface WorkOrder {
  id: string; company_id: string; number: string; title: string;
  description?: string; machine_id?: string; machine_name?: string;
  resp_id?: string; resp_name?: string; type?: string; sector?: string;
  priority: 'low'|'medium'|'high'|'critical'; status: 'open'|'progress'|'done'|'cancelled';
  open_date?: string; due_date?: string; close_date?: string;
  parts_used?: string; solution?: string; created_by?: string; created_at?: string;
}
export interface Machine {
  id: string; company_id: string; code?: string; name: string;
  sector?: string; category?: string; brand?: string; model?: string;
  location?: string; icon?: string; current_hours?: number;
  oil_interval?: number; last_oil_hours?: number; last_oil_date?: string;
  pm_plan?: any[]; components?: any[]; created_at?: string;
}
export interface Part {
  id: string; company_id: string; code: string; name: string;
  category?: string; unit: string; stock: number; min_stock: number;
  unit_value?: number; location?: string; supplier?: string; created_at?: string;
}
export interface MaintenanceRecord {
  id: string; company_id: string; machine_id?: string; machine_name?: string;
  type: string; resp: string; date: string; duration?: number;
  parts?: string; description?: string; result?: string;
  status?: string; close_date?: string; created_by?: string; created_at?: string;
}
