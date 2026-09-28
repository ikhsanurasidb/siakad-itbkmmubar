import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { State } from "@siakad-itbkmmubar/ui/components/state";
import { Textarea } from "@siakad-itbkmmubar/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CheckCircle2,
  MapPin,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

type AttendanceStatus = "HADIR" | "IZIN" | "SAKIT";

interface CaptureAttempt {
  captureAttemptId: string;
  expiresAt: string;
  meetingId: string;
  modality: "OFFLINE" | "ONLINE";
}

interface CameraCaptureProps {
  attempt: CaptureAttempt;
  onCancel: () => void;
  onSubmitted: () => void;
}

const statusLabels: Record<AttendanceStatus, string> = {
  HADIR: "Hadir",
  IZIN: "Izin",
  SAKIT: "Sakit",
};

const getAttendanceStatusLabel = (status: string): string => {
  if (status === "HADIR") {
    return "Hadir";
  }
  if (status === "IZIN") {
    return "Izin";
  }
  if (status === "SAKIT") {
    return "Sakit";
  }
  return "Alpa";
};

const getCameraErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Izin kamera ditolak. Aktifkan izin kamera pada pengaturan browser lalu coba lagi.";
    }
    if (error.name === "NotFoundError") {
      return "Kamera tidak ditemukan pada perangkat ini.";
    }
    if (error.name === "NotReadableError") {
      return "Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.";
    }
    if (error.name === "OverconstrainedError") {
      return "Kamera dengan konfigurasi yang diminta tidak tersedia.";
    }
  }
  return "Kamera belum dapat digunakan. Pastikan halaman dibuka melalui HTTPS atau localhost.";
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  // eslint-disable-next-line promise/avoid-new -- FileReader exposes an event-based browser API.
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener(
      "error",
      () => reject(new Error("Foto belum dapat dibaca.")),
      { once: true }
    );
    reader.addEventListener(
      "load",
      () => {
        const { result } = reader;
        if (typeof result !== "string") {
          reject(new Error("Foto belum dapat dibaca."));
          return;
        }
        resolve(result);
      },
      { once: true }
    );
    reader.readAsDataURL(blob);
  });

const getCurrentLocation = (): Promise<GeolocationPosition> =>
  // eslint-disable-next-line promise/avoid-new -- geolocation exposes an event-based browser API.
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Lokasi perangkat tidak tersedia."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 15_000,
      timeout: 15_000,
    });
  });

const CameraCapture = ({
  attempt,
  onCancel,
  onSubmitted,
}: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<
    readonly MediaDeviceInfo[]
  >([]);
  const capturedBlobRef = useRef<Blob | null>(null);
  const selectedDeviceIdRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("HADIR");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const submit = useMutation(orpc.attendance.submit.mutationOptions());

  const stopCamera = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
  }, []);

  const releasePreviewUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const revokePreview = useCallback(() => {
    releasePreviewUrl();
    setPreviewUrl(null);
    capturedBlobRef.current = null;
  }, [releasePreviewUrl]);

  const openCamera = useCallback(async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser ini tidak mendukung akses kamera live.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      selectedDeviceIdRef.current =
        stream.getVideoTracks().at(0)?.getSettings().deviceId ??
        deviceId ??
        null;
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameraDevices(devices.filter((item) => item.kind === "videoinput"));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraError(null);
    } catch (error) {
      setCameraError(getCameraErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react/set-state-in-effect -- camera permission state is synchronized after the user starts capture.
    const initializeCamera = async () => {
      await openCamera();
      if (cancelled) {
        stopCamera();
      }
    };
    initializeCamera();
    return () => {
      cancelled = true;
      stopCamera();
      releasePreviewUrl();
    };
  }, [openCamera, releasePreviewUrl, stopCamera]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
      setCameraError(
        "Tampilan kamera belum siap. Tunggu sebentar lalu coba lagi."
      );
      return;
    }
    const scale = Math.min(1, 1600 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Foto belum dapat dibuat dari kamera.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Foto belum dapat dibuat dari kamera.");
          return;
        }
        revokePreview();
        // eslint-disable-next-line react-doctor/no-create-object-url-without-revoke -- releasePreviewUrl revokes the active preview on retake, submit, cancel, and unmount.
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        capturedBlobRef.current = blob;
        setPreviewUrl(url);
        stopCamera();
      },
      "image/jpeg",
      0.88
    );
  };

  const submitPhoto = async () => {
    const capturedBlob = capturedBlobRef.current;
    if (!capturedBlob) {
      return;
    }
    setSubmitting(true);
    try {
      const contentBase64 = await blobToBase64(capturedBlob);
      const location =
        attempt.modality === "OFFLINE" ? await getCurrentLocation() : null;
      await submit.mutateAsync({
        accuracyMeters: location?.coords.accuracy,
        captureAttemptId: attempt.captureAttemptId,
        contentBase64,
        declaredMime: capturedBlob.type || "image/jpeg",
        filename: "presensi.jpg",
        idempotencyKey: crypto.randomUUID(),
        latitude: location?.coords.latitude,
        longitude: location?.coords.longitude,
        note: note || undefined,
        status,
      });
      toast.success(
        status === "HADIR"
          ? "Presensi berhasil dicatat."
          : "Pengajuan presensi berhasil dikirim."
      );
      queryClient.invalidateQueries({ queryKey: orpc.attendance.list.key() });
      onSubmitted();
    } catch (error) {
      setSubmitting(false);
      toast.error(
        error instanceof Error ? error.message : "Presensi belum dapat dikirim."
      );
    }
    setSubmitting(false);
  };

  const retakePhoto = async () => {
    revokePreview();
    await openCamera(selectedDeviceIdRef.current ?? undefined);
  };

  const switchCamera = async () => {
    const currentIndex = cameraDevices.findIndex(
      (device) => device.deviceId === selectedDeviceIdRef.current
    );
    const nextDevice = cameraDevices[(currentIndex + 1) % cameraDevices.length];
    if (!nextDevice) {
      return;
    }
    stopCamera();
    await openCamera(nextDevice.deviceId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ambil bukti dari kamera</CardTitle>
        <CardDescription>
          Foto hanya dapat diambil dari kamera live. Galeri dan pemilih berkas
          tidak tersedia.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {cameraError && (
          <div
            className="border-destructive/40 bg-destructive/10 rounded-xl border p-3 text-sm"
            role="alert"
          >
            {cameraError}
          </div>
        )}
        {previewUrl ? (
          <img
            alt="Pratinjau bukti presensi"
            className="mx-auto max-h-96 rounded-xl object-contain"
            src={previewUrl}
          />
        ) : (
          <video
            className="mx-auto aspect-video w-full max-w-xl rounded-xl bg-black object-cover"
            muted
            playsInline
            ref={videoRef}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Status presensi
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              id="attendance-status"
              onChange={(event) =>
                setStatus(event.target.value as AttendanceStatus)
              }
              value={status}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {status !== "HADIR" && (
            <label
              className="grid gap-1 text-sm sm:col-span-2"
              htmlFor="attendance-note"
            >
              Catatan pengajuan
              <Textarea
                id="attendance-note"
                maxLength={1000}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Jelaskan alasan pengajuan."
                value={note}
              />
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {previewUrl ? (
            <>
              <Button
                disabled={submitting}
                onClick={retakePhoto}
                variant="outline"
              >
                <RotateCcw aria-hidden="true" /> Ambil ulang
              </Button>
              <Button disabled={submitting} onClick={submitPhoto}>
                <CheckCircle2 aria-hidden="true" />{" "}
                {submitting ? "Mengirim…" : "Gunakan foto"}
              </Button>
            </>
          ) : (
            <>
              <Button disabled={Boolean(cameraError)} onClick={takePhoto}>
                <Camera aria-hidden="true" /> Ambil foto
              </Button>
              {cameraDevices.length > 1 && (
                <Button onClick={switchCamera} variant="outline">
                  <RotateCcw aria-hidden="true" /> Ganti kamera
                </Button>
              )}
            </>
          )}
          <Button disabled={submitting} onClick={onCancel} variant="ghost">
            <X aria-hidden="true" /> Batal
          </Button>
        </div>
        {attempt.modality === "OFFLINE" && (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <MapPin aria-hidden="true" /> Lokasi akan diminta saat foto dikirim
            dan divalidasi di server.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

interface AttendancePageProps {
  mode: "PARTICIPANT" | "REVIEWER";
  roleName: string;
}

const AttendancePage = ({ mode, roleName }: AttendancePageProps) => {
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState<CaptureAttempt | null>(null);
  const meetings = useQuery(
    orpc.attendance.list.queryOptions({ enabled: mode === "PARTICIPANT" })
  );
  const reviews = useQuery(
    orpc.attendance.reviews.list.queryOptions({
      enabled: mode === "REVIEWER",
      input: { status: "PENDING" },
    })
  );
  const startCapture = useMutation(
    orpc.attendance.startCapture.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: (result) => setAttempt(result),
    })
  );
  const decide = useMutation(
    orpc.attendance.decideRequest.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Keputusan pengajuan tersimpan.");
        queryClient.invalidateQueries({
          queryKey: orpc.attendance.reviews.key(),
        });
      },
    })
  );

  if (mode === "PARTICIPANT" && (meetings.isPending || meetings.isError)) {
    return (
      <div className="mx-auto grid w-full max-w-screen-xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Catat kehadiran dengan bukti foto dari kamera live."
          eyebrow={`Presensi · ${roleName}`}
          title="Presensi"
        />
        {meetings.isPending ? (
          <State
            description="Jadwal presensi sedang dimuat."
            title="Memuat presensi"
            variant="loading"
          />
        ) : (
          <State
            action={
              <Button onClick={() => meetings.refetch()} variant="outline">
                <RefreshCw aria-hidden="true" /> Coba lagi
              </Button>
            }
            description="Data presensi belum dapat dimuat."
            title="Presensi tidak tersedia"
            variant="error"
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-xl gap-6 p-4 lg:p-6">
      <PageHeader
        description={
          mode === "PARTICIPANT"
            ? "Catat kehadiran dengan bukti foto dari kamera live."
            : "Tinjau pengajuan presensi sesuai lingkup akses."
        }
        eyebrow={`Presensi · ${roleName}`}
        title="Presensi"
      />
      {attempt && (
        <CameraCapture
          attempt={attempt}
          onCancel={() => setAttempt(null)}
          onSubmitted={() => setAttempt(null)}
        />
      )}
      {mode === "PARTICIPANT" ? (
        <section aria-label="Daftar pertemuan presensi" className="grid gap-3">
          {(meetings.data ?? []).map((meeting) => (
            <Card key={meeting.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold">
                    {meeting.courseName} · {meeting.classCode}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Pertemuan ke-{meeting.sequence} ·{" "}
                    {new Date(meeting.startAt).toLocaleString("id-ID")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Window:{" "}
                    {new Date(meeting.openAt).toLocaleTimeString("id-ID")}–
                    {new Date(meeting.closeAt).toLocaleTimeString("id-ID")}
                  </p>
                </div>
                {meeting.record ? (
                  <span className="text-sm font-medium">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mr-1 inline text-emerald-600"
                    />{" "}
                    {getAttendanceStatusLabel(meeting.record.status)}
                  </span>
                ) : (
                  <Button
                    disabled={startCapture.isPending}
                    onClick={() =>
                      startCapture.mutate({ meetingId: meeting.id })
                    }
                  >
                    <Camera aria-hidden="true" /> Mulai presensi
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {(meetings.data ?? []).length === 0 && (
            <State
              description="Belum ada pertemuan yang dapat dipresensi."
              title="Belum ada jadwal presensi"
              variant="not-found"
            />
          )}
        </section>
      ) : (
        <section aria-label="Daftar pengajuan presensi" className="grid gap-3">
          {(reviews.data ?? []).map((review) => (
            <Card key={review.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold">
                    {review.courseName} · {review.classCode}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {review.participantName} · Pengajuan{" "}
                    {review.requestedStatus === "IZIN" ? "izin" : "sakit"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        approve: false,
                        expectedVersion: 1,
                        reason: "Bukti atau alasan belum memenuhi ketentuan.",
                        requestId: review.id,
                      })
                    }
                    variant="outline"
                  >
                    Tolak
                  </Button>
                  <Button
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        approve: true,
                        expectedVersion: 1,
                        requestId: review.id,
                      })
                    }
                  >
                    Setujui
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(reviews.data ?? []).length === 0 && (
            <State
              description="Belum ada pengajuan pada lingkup akses Anda."
              title="Tidak ada pengajuan"
              variant="not-found"
            />
          )}
        </section>
      )}
    </div>
  );
};

export default AttendancePage;
