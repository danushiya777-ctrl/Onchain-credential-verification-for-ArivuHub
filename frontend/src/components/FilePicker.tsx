import { useState } from "react";

type Props = {
  onFile: (file: File | null) => void;
  disabled?: boolean;
};

export default function FilePicker({ onFile, disabled }: Props) {
  const [name, setName] = useState<string>("");

  return (
    <label className={`file-picker ${disabled ? "disabled" : ""}`}>
      <input
        type="file"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setName(f?.name ?? "");
          onFile(f);
        }}
      />
      <span>{name || "Choose a certificate file (PDF, JSON, image...)"}</span>
    </label>
  );
}

