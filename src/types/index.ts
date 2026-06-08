export interface Machine {
  id: string; code: string; name: string; sector: string; category: string
  brand?: string; model?: string; year?: number; serial?: string
  location?: string; power?: string; notes?: string; icon?: string
  current_hours?: number; oil_interval?: number; last_oil_hours?: number; last_oil_date?: string
  components?: any[]; parts?: any[]; pm_plan?: any[]
  created_at: string; updated_at?: string
}
export interface WorkOrder {
  id: string; number: string; title: string; description?: string
  machine_id?: string; machine_name?: string; machine_code?: string
  resp_id?: string; resp_name?: string; sector?: string; type?: string
  priority: 'low'|'medium'|'high'|'critical'; status: 'open'|'progress'|'done'|'cancelled'
  open_date: string; due_date?: string; close_date?: string
  est_hours?: number; actual_hours?: number; parts_used?: string; solution?: string
  photos?: string[]; signature?: string; cost?: number
  created_by?: string; created_at: string
}
export interface Maintenance {
  id: string; machine_id: string; machine_name?: string; type: string
  resp: string; date: string; duration?: number; parts?: string
  description?: string; result: string; pm_task?: string
  photos?: string[]; cost?: number; created_by?: string; created_at: string
}
export interface PMReport {
  id: string; machine_id: string; machine_name?: string
  operator: string; period: string; date: string
  hours_reading?: number; checklist?: Record<string,boolean>
  notes?: string; status: string; signature?: string
  created_by?: string; created_at: string
}
export interface Task {
  id: string; title: string; date: string; time?: string
  priority: string; owner_id?: string; owner_name?: string
  notes?: string; done: boolean
  created_by?: string; created_at: string
}
export interface Part {
  id: string; code: string; name: string; category: string
  unit: string; stock: number; min_stock: number
  unit_value?: number; location?: string; supplier?: string
  created_at: string
}
export interface Supplier {
  id: string; name: string; cnpj?: string; phone?: string
  whatsapp?: string; email?: string; city?: string
  created_at: string
}
export interface UserProfile {
  id: string; email: string; display_name?: string
  role: 'admin'|'supervisor'|'operator'|'viewer'
  shift?: string; sector?: string; code?: string; blocked?: boolean
  created_at: string
}
export interface ChecklistItem { task: string; period: string }
export interface PMPlanItem { task: string; period: string }
