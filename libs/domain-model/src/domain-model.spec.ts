import { PetSpecies } from './enums';
import {
  toItemPet,
  fromItemPet,
  toItemUserAccount,
  fromItemUserAccount,
  toItemPetReminder,
  fromItemPetReminder,
  toItemRoutineDefinition,
  fromItemRoutineDefinition,
  toItemRoutineOccurrence,
  fromItemRoutineOccurrence,
} from './mappers';
import {
  RoutineOccurrenceStatus,
  RoutineStatus,
  RoutineType,
} from './enums';
import { Pet, PetReminder, UserAccount } from './types';

describe('domain-model mappers', () => {
  it('round-trips a pet item', () => {
    const pet: Pet = {
      petId: 'pet-1',
      ownerId: 'owner-1',
      name: 'Fido',
      species: PetSpecies.DOG,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    };

    const item = toItemPet(pet);
    expect(item.PK).toBe('PET#pet-1');
    expect(item.SK).toBe('METADATA');

    const back = fromItemPet(item);
    expect(back).toMatchObject({
      petId: pet.petId,
      ownerId: pet.ownerId,
      name: pet.name,
      species: pet.species,
    });
  });

  it('round-trips a user account', () => {
    const user: UserAccount = {
      userId: 'u1',
      email: 'user@example.com',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    };

    const item = toItemUserAccount(user);
    expect(item.PK).toBe('USER#u1');
    expect(item.SK).toBe('PROFILE');

    const back = fromItemUserAccount(item);
    expect(back).toEqual({
      userId: user.userId,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: undefined,
    });
  });

  it('generates GSI keys for reminders', () => {
    const reminder: PetReminder = {
      reminderId: 'rem-1',
      petId: 'pet-1',
      eventId: 'evt-1',
      dueDate: new Date('2025-02-10T00:00:00.000Z'),
      createdAt: new Date('2025-01-20T00:00:00.000Z'),
    };

    const item = toItemPetReminder(reminder);
    expect(item.PK).toBe('PET#pet-1');
    expect(item.SK).toBe('REMINDER#rem-1');
    expect(item.GSI1PK).toBe('REMINDER#VACCINATION');
    expect(item.GSI1SK).toContain('PET#pet-1');

    const back = fromItemPetReminder(item);
    expect(back.petId).toBe(reminder.petId);
    expect(back.reminderId).toBe(reminder.reminderId);
    expect(back.eventId).toBe(reminder.eventId);
  });

  it('throws on missing required fields', () => {
    expect(() =>
      toItemPet({
        petId: 'pet-1',
        name: '', // missing species
        species: undefined as unknown as any,
        createdAt: new Date(),
      } as unknown as any),
    ).toThrow();
  });

  it('round-trips a routine definition item', () => {
    const routine = {
      activityId: 'act-1',
      routineId: 'pet-1',
      petId: 'pet-1',
      ownerUserId: 'owner-1',
      title: 'Morning walk',
      type: RoutineType.WALKING,
      status: RoutineStatus.ACTIVE,
      timezone: 'America/Guatemala',
      schedule: { frequency: 'DAILY', times: ['07:00'] } as const,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const item = toItemRoutineDefinition(routine);
    expect(item.SK).toBe('ROUTINE_ACTIVITY#act-1');

    const back = fromItemRoutineDefinition(item);
    expect(back).toMatchObject({
      activityId: routine.activityId,
      petId: routine.petId,
      type: routine.type,
      status: routine.status,
    });
  });

  it('round-trips a routine occurrence item', () => {
    const occurrence = {
      occurrenceId: 'occ-1',
      routineId: 'pet-1',
      activityId: 'act-1',
      petId: 'pet-1',
      scheduledFor: new Date('2026-01-02T07:00:00.000Z'),
      status: RoutineOccurrenceStatus.PENDING,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const item = toItemRoutineOccurrence(occurrence);
    expect(item.SK).toContain('ROUTINE_OCC#2026-01-02T07:00:00.000Z#act-1#occ-1');

    const back = fromItemRoutineOccurrence(item);
    expect(back).toMatchObject({
      occurrenceId: occurrence.occurrenceId,
      routineId: occurrence.routineId,
      activityId: occurrence.activityId,
      petId: occurrence.petId,
      status: occurrence.status,
    });
  });
});
