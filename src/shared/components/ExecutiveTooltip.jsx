export default function ExecutiveTooltip({
  term,
  description,
}) {
  return (
    <span className="relative group inline-flex cursor-help">

      <span className="border-b border-dashed border-gray-400 font-medium text-[#334155]">
        {term}
      </span>

      <div
        className="
          absolute
          left-0
          top-full
          mt-3
          w-[340px]
          rounded-2xl
          bg-white/80
          backdrop-blur-xl
          text-gray-500
          text-[13px]
          leading-relaxed
          p-4
          shadow-[0_20px_60px_rgba(0,0,0,0.10)]
          opacity-0
          invisible
          translate-y-2
          group-hover:opacity-100
          group-hover:visible
          group-hover:translate-y-0
          transition-all
          duration-200
          z-[9999]
          border
          border-white/40
        "
      >

        <div className="text-[10px] uppercase tracking-[0.25em] font-semibold text-red-300 mb-2">
          Definición
        </div>

        <div className="font-normal">
          {description}
        </div>

      </div>

    </span>
  );
}