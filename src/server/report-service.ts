import 'server-only';

import { randomBytes } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import { Prisma, ReportStatus } from '@prisma/client';

import { CurrentClerkUser } from './auth';
import { AppError } from './errors';
import { getOrCreateCurrentProfile } from './profile-service';
import { deleteReportImage, storeReportImage } from './storage';
import { ValidatedReportMetadata } from './report-validation';

const MAX_PUBLIC_REFERENCE_ATTEMPTS = 5;

const safeReportSelect = {
  id: true,
  publicReference: true,
  latitude: true,
  longitude: true,
  province: true,
  district: true,
  observedAt: true,
  quantityRange: true,
  status: true,
  isSeedData: true,
  imagePath: true
} as const;

export type SafeReport = {
  id: string;
  publicReference: string;
  latitude: number;
  longitude: number;
  province: string;
  district: string | null;
  observedAt: Date;
  quantityRange: string;
  status: ReportStatus;
  isSeedData: boolean;
  imagePath: string;
};

function roundCoordinate(value: number): number {
  return Number(value.toFixed(3));
}

export function safeReport(report: SafeReport, includeImage = false, publicCoordinates = true) {
  return {
    id: report.id,
    publicReference: report.publicReference,
    latitude: publicCoordinates ? roundCoordinate(report.latitude) : report.latitude,
    longitude: publicCoordinates ? roundCoordinate(report.longitude) : report.longitude,
    province: report.province,
    district: report.district,
    observedAt: report.observedAt,
    quantityRange: report.quantityRange,
    status: report.status,
    // System-validation provenance — the UI renders a restrained marker on
    // seed records so they are never mistaken for real citizen reports.
    isSeedData: report.isSeedData,
    // imageUrl only when a real image exists — seed records carry none and an
    // imageUrl would point at a route that 404s, leaving broken-image icons.
    ...(includeImage && report.imagePath ? { imageUrl: `/api/reports/${report.id}/image` } : {})
  };
}

function publicReference(): string {
  const year = new Date().getUTCFullYear();
  return `FD-${year}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function isPublicReferenceConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
    return false;
  const target = error.meta?.target;
  return (
    target === 'publicReference' || (Array.isArray(target) && target.includes('publicReference'))
  );
}

export async function createReport(
  context: CurrentClerkUser,
  metadata: ValidatedReportMetadata,
  image: { data: Uint8Array; contentType: string }
) {
  const stored = await storeReportImage(image);
  try {
    const profile = await getOrCreateCurrentProfile(context);
    for (let attempt = 0; attempt < MAX_PUBLIC_REFERENCE_ATTEMPTS; attempt += 1) {
      try {
        return await prisma.sightingReport.create({
          data: {
            publicReference: publicReference(),
            reporter: { connect: { id: profile.id } },
            latitude: metadata.latitude,
            longitude: metadata.longitude,
            province: metadata.province,
            district: metadata.district,
            subdistrict: metadata.subdistrict,
            locationDescription: metadata.locationDescription,
            observedAt: metadata.observedAt,
            quantityRange: metadata.quantityRange,
            note: metadata.note,
            imagePath: stored.relativePath,
            status: ReportStatus.PENDING
          },
          select: { id: true, publicReference: true, status: true }
        });
      } catch (error) {
        if (!isPublicReferenceConflict(error)) throw error;
        if (attempt === MAX_PUBLIC_REFERENCE_ATTEMPTS - 1) {
          throw new AppError(
            'PUBLIC_REFERENCE_UNAVAILABLE',
            503,
            'A public reference could not be allocated'
          );
        }
      }
    }

    throw new AppError(
      'PUBLIC_REFERENCE_UNAVAILABLE',
      503,
      'A public reference could not be allocated'
    );
  } catch (error) {
    await deleteReportImage(stored.relativePath).catch(() => undefined);
    throw error;
  }
}

export async function listPublicReports() {
  const reports = await prisma.sightingReport.findMany({
    where: { status: ReportStatus.VERIFIED },
    orderBy: { observedAt: 'desc' },
    take: 1000,
    select: safeReportSelect
  });
  return reports.map((report) => safeReport(report));
}

export async function listCurrentUserReports(context: CurrentClerkUser) {
  const profile = await getOrCreateCurrentProfile(context);
  const [reports, total, counts] = await Promise.all([
    prisma.sightingReport.findMany({
      where: { reporterId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: safeReportSelect
    }),
    prisma.sightingReport.count({ where: { reporterId: profile.id } }),
    prisma.sightingReport.groupBy({
      by: ['status'],
      where: { reporterId: profile.id },
      _count: { _all: true }
    })
  ]);

  const countByStatus = Object.fromEntries(counts.map((item) => [item.status, item._count._all]));
  return {
    reports: reports.map((report) => safeReport(report, true, false)),
    counts: {
      total,
      PENDING: countByStatus.PENDING ?? 0,
      VERIFIED: countByStatus.VERIFIED ?? 0,
      REJECTED: countByStatus.REJECTED ?? 0
    }
  };
}

export async function getReportForViewer(id: string, clerkUserId: string | null) {
  const report = await prisma.sightingReport.findUnique({
    where: { id },
    select: { ...safeReportSelect, imagePath: true, reporter: { select: { clerkUserId: true } } }
  });
  if (!report) return null;

  const isPublic = report.status === ReportStatus.VERIFIED;
  const isOwner = clerkUserId !== null && report.reporter.clerkUserId === clerkUserId;
  if (!isPublic && !isOwner) return null;
  return safeReport(report, true, isPublic);
}

export async function getReportImageAccess(id: string, clerkUserId: string | null) {
  const report = await prisma.sightingReport.findUnique({
    where: { id },
    select: { status: true, imagePath: true, reporter: { select: { clerkUserId: true } } }
  });
  if (!report) return null;
  if (report.status !== ReportStatus.VERIFIED && report.reporter.clerkUserId !== clerkUserId)
    return null;
  return report;
}
