export interface User {
  id: string;
  email: string;
  password: string;
  full_name: string;
  age: number;
  category: 'General' | 'OBC' | 'SC' | 'ST' | 'EWS' | '';
  state: string;
  qualification_type: 'Class 10' | 'Class 12' | 'Graduation' | 'Post Graduation' | 'PhD' | '';
  qualification_status: 'Completed' | 'Pursuing' | '';
  current_year: number;
  current_semester: number;
  expected_graduation_year: number;
}

export type FormStatus = 'LIVE' | 'UPCOMING' | 'CLOSED' | 'RECENTLY_CLOSED';

export interface Job {
  id: string;
  job_name: string;
  organization: string;
  qualification_required: 'Class 10' | 'Class 12' | 'Graduation' | 'Post Graduation' | 'PhD';
  allows_final_year_students: boolean;
  minimum_age: number;
  maximum_age: number;
  application_start_date: string;
  application_end_date: string;
  form_status: FormStatus;
  salary_min: number;
  salary_max: number;
  job_category: string;
  official_application_link: string;
  official_notification_link?: string;
  official_website_link?: string;
  description?: string;
  selection_process?: string;
  syllabus?: string;
  state: string;
  states?: string[];
}

export interface Notification {
  id: string;
  user_id: string;
  job_id: string;
  message: string;
  created_at: string;
}

export interface LikedJob {
  user_id: string;
  job_id: string;
}

export interface Roadmap {
  user_id: string;
  job_id: string;
  content: string;
  created_at: string;
}
