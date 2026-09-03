const { z } = require('zod');

// Auth Schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters long'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

// Trip Schemas
const createTripSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  destination: z.string().min(1, 'Destination is required'),
  startDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().optional()),
  endDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().optional()),
  budget: z.number().nonnegative('Budget must be a positive number').optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Itinerary Item Schema
const createItinerarySchema = z.object({
  title: z.string().min(1, 'Activity title is required'),
  location: z.string().optional().nullable(),
  dayNumber: z.number().int().positive('Day number must be a positive integer').optional().nullable(),
  startTime: z.string().optional().nullable(),
  cost: z.number().nonnegative('Cost cannot be negative').optional().nullable(),
  notes: z.string().optional().nullable(),
});

module.exports = {
  registerSchema,
  loginSchema,
  createTripSchema,
  createItinerarySchema,
};