/**
 * Unit tests for attendance service functions.
 */
import { describe, expect, it } from 'vitest';
import { resolveEmployeeId } from '../src/services/attendance/functions.js';
import { OdooValidationError } from '../src/types/errors.js';

// We can't easily unit-test clockIn/clockOut without mocking the full client,
// but we can test resolveEmployeeId behavior and validate the types compile.

describe('resolveEmployeeId', () => {
  it('should return provided employeeId directly', async () => {
    const mockClient = {} as unknown;
    const result = await resolveEmployeeId(mockClient, 42);
    expect(result).toBe(42);
  });

  it('should throw when no session and no employeeId', async () => {
    const mockClient = {
      getSession: () => null,
    } as unknown;

    await expect(resolveEmployeeId(mockClient)).rejects.toThrow(OdooValidationError);
    await expect(resolveEmployeeId(mockClient)).rejects.toThrow(/no active session/);
  });

  it('should throw when no employee found for user', async () => {
    const mockClient = {
      getSession: () => ({ uid: 99 }),
      searchRead: async () => [],
    } as unknown;

    await expect(resolveEmployeeId(mockClient)).rejects.toThrow(OdooValidationError);
    await expect(resolveEmployeeId(mockClient)).rejects.toThrow(/No hr.employee record/);
  });

  it('should resolve employee from session uid', async () => {
    const mockClient = {
      getSession: () => ({ uid: 2 }),
      searchRead: async () => [{ id: 7 }],
    } as unknown;

    const result = await resolveEmployeeId(mockClient);
    expect(result).toBe(7);
  });
});
