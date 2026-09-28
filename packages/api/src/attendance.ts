import type { RoleKey } from "@api/identity";

export const attendanceParticipantTypes = ["STUDENT", "LECTURER"] as const;
export type AttendanceParticipantType =
  (typeof attendanceParticipantTypes)[number];

export const attendanceStatuses = ["HADIR", "IZIN", "SAKIT", "ALPA"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export class AttendanceDomainError extends Error {
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(
    code: string,
    message: string,
    fieldErrors: Readonly<Record<string, readonly string[]>> = {}
  ) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.name = "AttendanceDomainError";
  }
}

export interface AttendancePolicySnapshot {
  closeOffsetMinutes: number;
  openOffsetMinutes: number;
  radiusMeters: number;
}

export interface AttendanceWindow {
  closeAt: Date;
  openAt: Date;
}

export interface AttendanceMeetingRecord {
  classCode: string;
  classSectionId: string;
  closeAt: string;
  courseName: string;
  endAt: string;
  id: string;
  modality: "OFFLINE" | "ONLINE";
  openAt: string;
  record: {
    id: string;
    status: AttendanceStatus;
  } | null;
  sequence: number;
  startAt: string;
}

export interface AttendanceCaptureAttemptRecord {
  captureAttemptId: string;
  expiresAt: string;
  meetingId: string;
  modality: "OFFLINE" | "ONLINE";
  participantType: AttendanceParticipantType;
}

export interface AttendanceRecordResult {
  id: string;
  requestedStatus: AttendanceStatus | null;
  status: AttendanceStatus;
  submittedAt: string;
}

export interface AttendanceReviewRecord {
  classCode: string;
  courseName: string;
  createdAt: string;
  id: string;
  participantId: string;
  participantName: string;
  requestedStatus: "IZIN" | "SAKIT";
  status: "PENDING" | "APPROVED" | "REJECTED";
}

const MIN_IMAGE_DIMENSION = 120;
const MAX_IMAGE_DIMENSION = 8000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const readUint24 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] ?? 0) +
  (bytes[offset + 1] ?? 0) * 256 +
  (bytes[offset + 2] ?? 0) * 65_536;

const bytesToAscii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCodePoint(...bytes.slice(start, end));

const pngDimensions = (
  bytes: Uint8Array
): { height: number; width: number } | null => {
  if (
    bytes.length < 33 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytesToAscii(bytes, 12, 16) !== "IHDR"
  ) {
    return null;
  }
  const copy = Uint8Array.from(bytes);
  const view = new DataView(copy.buffer);
  return { height: view.getUint32(20), width: view.getUint32(16) };
};

const webpDimensions = (
  bytes: Uint8Array
): { height: number; width: number } | null => {
  if (
    bytes.length < 30 ||
    bytesToAscii(bytes, 0, 4) !== "RIFF" ||
    bytesToAscii(bytes, 8, 12) !== "WEBP" ||
    bytesToAscii(bytes, 12, 16) !== "VP8X"
  ) {
    return null;
  }
  return {
    height: readUint24(bytes, 27) + 1,
    width: readUint24(bytes, 24) + 1,
  };
};

// eslint-disable-next-line complexity -- JPEG marker parsing necessarily checks several format boundaries.
const jpegDimensions = (
  bytes: Uint8Array
): { height: number; width: number } | null => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }
    const segmentLength = (bytes[offset] ?? 0) * 256 + (bytes[offset + 1] ?? 0);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null;
    }
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xc3 && marker !== 0xc1 && marker !== 0xc4;
    if (isStartOfFrame && segmentLength >= 7) {
      return {
        height: (bytes[offset + 3] ?? 0) * 256 + (bytes[offset + 4] ?? 0),
        width: (bytes[offset + 5] ?? 0) * 256 + (bytes[offset + 6] ?? 0),
      };
    }
    offset += segmentLength;
  }
  return null;
};

const imageDimensions = (
  bytes: Uint8Array,
  mimeType: string
): { height: number; width: number } | null => {
  if (mimeType === "image/png") {
    return pngDimensions(bytes);
  }
  if (mimeType === "image/webp") {
    return webpDimensions(bytes);
  }
  return mimeType === "image/jpeg" ? jpegDimensions(bytes) : null;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const calculateAttendanceWindow = (
  startAt: Date,
  endAt: Date,
  policy: AttendancePolicySnapshot
): AttendanceWindow => {
  if (
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    endAt <= startAt
  ) {
    throw new AttendanceDomainError(
      "INVALID_MEETING_WINDOW",
      "Waktu pertemuan tidak valid."
    );
  }
  if (
    !Number.isInteger(policy.openOffsetMinutes) ||
    policy.openOffsetMinutes < 0 ||
    !Number.isInteger(policy.closeOffsetMinutes) ||
    policy.closeOffsetMinutes < 0 ||
    !Number.isFinite(policy.radiusMeters) ||
    policy.radiusMeters <= 0
  ) {
    throw new AttendanceDomainError(
      "INVALID_ATTENDANCE_POLICY",
      "Kebijakan presensi tidak valid."
    );
  }
  return {
    closeAt: new Date(endAt.getTime() + policy.closeOffsetMinutes * 60_000),
    openAt: new Date(startAt.getTime() + policy.openOffsetMinutes * 60_000),
  };
};

export const assertAttendanceWindowOpen = (
  now: Date,
  window: AttendanceWindow
): void => {
  if (
    Number.isNaN(now.getTime()) ||
    now < window.openAt ||
    now > window.closeAt
  ) {
    throw new AttendanceDomainError(
      "ATTENDANCE_WINDOW_CLOSED",
      "Presensi belum dibuka atau window presensi sudah ditutup."
    );
  }
};

export const assertCoordinate = (
  value: number,
  name: "latitude" | "longitude"
): number => {
  const maximum = name === "latitude" ? 90 : 180;
  if (!Number.isFinite(value) || value < -maximum || value > maximum) {
    throw new AttendanceDomainError(
      "INVALID_COORDINATE",
      "Koordinat lokasi tidak valid.",
      {
        [name]: [
          name === "latitude"
            ? "Latitude harus berada di antara -90 dan 90."
            : "Longitude harus berada di antara -180 dan 180.",
        ],
      }
    );
  }
  return value;
};

export const calculateDistanceMeters = (
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
): number => {
  assertCoordinate(first.latitude, "latitude");
  assertCoordinate(first.longitude, "longitude");
  assertCoordinate(second.latitude, "latitude");
  assertCoordinate(second.longitude, "longitude");
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
};

export const validateEvidenceImage = ({
  bytes,
  declaredMime,
  maxBytes = MAX_IMAGE_BYTES,
}: {
  bytes: Uint8Array;
  declaredMime: string;
  maxBytes?: number;
}): {
  height: number;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
} => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
  if (
    !allowedMimeTypes.includes(
      declaredMime as (typeof allowedMimeTypes)[number]
    )
  ) {
    throw new AttendanceDomainError(
      "INVALID_EVIDENCE_MIME",
      "Foto presensi harus berupa JPEG, PNG, atau WebP."
    );
  }
  if (bytes.length < 1 || bytes.length > maxBytes) {
    throw new AttendanceDomainError(
      "INVALID_EVIDENCE_SIZE",
      "Ukuran foto presensi tidak valid."
    );
  }
  const mimeType = declaredMime as (typeof allowedMimeTypes)[number];
  const dimensions = imageDimensions(bytes, mimeType);
  if (
    !dimensions ||
    !Number.isInteger(dimensions.width) ||
    !Number.isInteger(dimensions.height) ||
    dimensions.width < MIN_IMAGE_DIMENSION ||
    dimensions.height < MIN_IMAGE_DIMENSION ||
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION
  ) {
    throw new AttendanceDomainError(
      "INVALID_EVIDENCE_IMAGE",
      "Isi atau dimensi foto presensi tidak valid."
    );
  }
  return { ...dimensions, mimeType };
};

export const participantTypeForRoles = (
  roles: readonly RoleKey[]
): AttendanceParticipantType => {
  if (roles.includes("MAHASISWA")) {
    return "STUDENT";
  }
  if (roles.includes("DOSEN")) {
    return "LECTURER";
  }
  throw new AttendanceDomainError(
    "ATTENDANCE_SUBMIT_DENIED",
    "Hanya mahasiswa atau dosen yang dapat mengirim presensi."
  );
};

export const assertAttendanceReviewRole = (roles: readonly RoleKey[]): void => {
  if (
    !roles.some((role) =>
      ["SUPERADMIN", "ADMIN_AKADEMIK", "KAPRODI", "DOSEN"].includes(role)
    )
  ) {
    throw new AttendanceDomainError(
      "ATTENDANCE_REVIEW_DENIED",
      "Peran Anda tidak memiliki akses untuk meninjau presensi."
    );
  }
};

export const attendancePolicyVersion = (
  policy: AttendancePolicySnapshot
): string =>
  `attendance:${policy.openOffsetMinutes}:${policy.closeOffsetMinutes}:${policy.radiusMeters}`;
