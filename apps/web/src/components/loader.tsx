import { LoaderCircle } from "lucide-react";

const Loader = () => (
  <output
    aria-label="Memuat halaman"
    className="flex min-h-48 items-center justify-center"
  >
    <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
    <span className="sr-only">Memuat halaman</span>
  </output>
);

export default Loader;
