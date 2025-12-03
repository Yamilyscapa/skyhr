import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users, user_payroll } from "../../db/schema";

export interface UpdatePayrollData {
  userId: string;
  hourlyRate: number;
}

export interface PayrollResult {
  id: string;
  userId: string;
  hourlyRate: number;
}

/**
 * Validates that a user exists in the database
 * @param userId - The user ID to validate
 * @returns The user record if found
 * @throws Error if user is not found
 */
export async function validateUserExists(userId: string) {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0] ?? null;

  if (!user || user.id !== userId) {
    throw new Error("User not found");
  }

  return user;
}

/**
 * Validates that an hourly rate is valid
 * @param hourlyRate - The hourly rate to validate
 * @throws Error if hourly rate is invalid
 */
export function validateHourlyRate(hourlyRate: number): void {
  if (!hourlyRate) {
    throw new Error("Hourly rate is required");
  }

  if (hourlyRate <= 0) {
    throw new Error("Hourly rate must be greater than 0");
  }
}

/**
 * Updates a user's hourly rate in the payroll table
 * @param data - The payroll update data
 * @returns The updated payroll record
 * @throws Error if update fails
 */
export async function updateUserPayroll(data: UpdatePayrollData): Promise<PayrollResult> {
  const { userId, hourlyRate } = data;

  // Validate user exists
  await validateUserExists(userId);

  // Validate hourly rate
  validateHourlyRate(hourlyRate);

  // Update or insert payroll record
  const updatedUser = await db
    .update(user_payroll)
    .set({ hourly_rate: hourlyRate, updated_at: new Date() })
    .where(eq(user_payroll.user_id, userId))
    .returning();

  const updatedRate = updatedUser[0]?.hourly_rate ?? null;

  if (!updatedUser.length || !updatedRate) {
    // If update didn't find a record, try to insert
    const inserted = await db
      .insert(user_payroll)
      .values({
        user_id: userId,
        hourly_rate: hourlyRate,
      })
      .returning();

    const insertedRecord = inserted[0];
    if (!insertedRecord || !insertedRecord.hourly_rate) {
      throw new Error("Failed to update user hourly rate");
    }

    return {
      id: insertedRecord.id,
      userId: insertedRecord.user_id,
      hourlyRate: insertedRecord.hourly_rate,
    };
  }

  const updatedRecord = updatedUser[0];
  if (!updatedRecord) {
    throw new Error("Failed to update user hourly rate");
  }

  return {
    id: updatedRecord.id,
    userId: updatedRecord.user_id,
    hourlyRate: updatedRate,
  };
}


export async function getUserPayroll(userId: string): Promise<PayrollResult | null> {
  const userPayrollRows = await db.select().from(user_payroll).where(eq(user_payroll.user_id, userId)).limit(1);
  const userPayroll = userPayrollRows[0] ?? null;

  if (!userPayroll) {
    return null;
  }

  return {
    id: userPayroll.id,
    userId: userPayroll.user_id,
    hourlyRate: userPayroll.hourly_rate,
  };
}

export async function allowOvertime(userId: string, overtimeAllowed: boolean): Promise<void> {
  await db.update(user_payroll).set({ overtime_allowed: overtimeAllowed }).where(eq(user_payroll.user_id, userId));
}

export async function getOvertime(userId: string): Promise<boolean> {
  const userPayrollRows = await db.select().from(user_payroll).where(eq(user_payroll.user_id, userId)).limit(1);
  const userPayroll = userPayrollRows[0] ?? null;

  if (!userPayroll) {
    return false;
  }

  return userPayroll.overtime_allowed;
}