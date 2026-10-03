import React, { useState } from "react";
import { CalendarDays, HeartPulse, Route, Save } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { validateWorkoutInput, type WorkoutValidationErrors } from "@/lib/workout-validation";

interface Props {
  today: string;
  serverError?: string | null;
}

export default function WorkoutForm({ today, serverError }: Props) {
  const [workoutDate, setWorkoutDate] = useState(today);
  const [distanceKm, setDistanceKm] = useState("");
  const [avgHeartRate, setAvgHeartRate] = useState("");
  const [errors, setErrors] = useState<WorkoutValidationErrors>({});

  function validate() {
    const result = validateWorkoutInput(
      { workout_date: workoutDate, distance_km: distanceKm, avg_heart_rate: avgHeartRate },
      today,
    );
    const next = result.ok ? {} : result.errors;
    setErrors(next);
    return result.ok;
  }

  function clearError(field: keyof WorkoutValidationErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/workouts" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="workout_date"
        type="date"
        label="Data"
        value={workoutDate}
        max={today}
        onChange={(v) => {
          setWorkoutDate(v);
          clearError("workout_date");
        }}
        error={errors.workout_date}
        icon={<CalendarDays className="size-4" />}
      />

      <FormField
        id="distance_km"
        label="Dystans (km)"
        inputMode="decimal"
        value={distanceKm}
        onChange={(v) => {
          setDistanceKm(v);
          clearError("distance_km");
        }}
        placeholder="np. 10,5"
        error={errors.distance_km}
        icon={<Route className="size-4" />}
      />

      <FormField
        id="avg_heart_rate"
        label="Średnie tętno (ud/min)"
        inputMode="numeric"
        value={avgHeartRate}
        onChange={(v) => {
          setAvgHeartRate(v);
          clearError("avg_heart_rate");
        }}
        placeholder="np. 145"
        error={errors.avg_heart_rate}
        icon={<HeartPulse className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Zapisywanie..." icon={<Save className="size-4" />}>
        Zapisz trening
      </SubmitButton>

      <a href="/dashboard" className="block text-center text-sm text-purple-300 hover:underline">
        Anuluj
      </a>
    </form>
  );
}
