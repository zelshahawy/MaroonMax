export type MovementType = "squat" | "bench" | "deadlift";
export type LiftStatus = "waiting" | "lifting" | "success" | "fail";

export interface Attempt {
  weight: number | null;
  status: LiftStatus;
}

export interface MeetStatus {
  id: 1;
  current_movement: MovementType;
  current_round: 1 | 2 | 3;
  is_round_active: boolean;
  is_meet_active: boolean;
}

export interface Lifter {
  id: string;
  name: string;
  squat_1: Attempt;
  squat_2: Attempt;
  squat_3: Attempt;
  bench_1: Attempt;
  bench_2: Attempt;
  bench_3: Attempt;
  deadlift_1: Attempt;
  deadlift_2: Attempt;
  deadlift_3: Attempt;
  best_squat: number;
  best_bench: number;
  best_deadlift: number;
  total: number;
}

export interface LifterInsert {
  id: string
  name: string
  squat_1: Attempt
  squat_2: Attempt
  squat_3: Attempt
  bench_1: Attempt
  bench_2: Attempt
  bench_3: Attempt
  deadlift_1: Attempt
  deadlift_2: Attempt
  deadlift_3: Attempt
}