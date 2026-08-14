import Image from "next/image";
import { Surface } from "@/components/app-ui";

export function InboxZeroState() {
  return (
    <Surface className="inbox-zero relative isolate h-[148px] overflow-hidden px-4 text-center sm:px-8">
      <Image
        src="/mergetray-mascot-card.png"
        alt=""
        width={1024}
        height={1024}
        aria-hidden="true"
        className="inbox-zero-mascot pointer-events-none absolute -right-6 -bottom-4 z-10 w-40 select-none sm:-right-7 sm:w-44"
        priority
        unoptimized
      />
      <div className="relative flex h-full items-center justify-center pr-24 sm:pr-32">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-teal-700">
            Victory lap
          </p>
          <h2 className="mt-1 text-2xl font-semibold leading-none tracking-normal text-balance sm:text-3xl">
            Inbox zero, hero!
          </h2>
        </div>
      </div>
    </Surface>
  );
}
