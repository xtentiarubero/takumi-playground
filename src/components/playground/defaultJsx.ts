export const DEFAULT_JSX = `<div style={twj("h-full w-full flex items-start justify-start bg-white")}>
  <div style={twj("flex items-start justify-start h-full w-full relative")}>
    <img
      style={{ ...twj("absolute inset-0 w-full h-full"), ...{ objectFit: "cover" } }}
      src="https://picsum.photos/seed/picsum/1200/630"
    />
    <div
      style={{ ...twj("absolute inset-0 w-full h-full"), ...{ backgroundColor: "rgba(0,0,0,0.6)" } }}
    ></div>
    <div style={twj("flex items-center justify-center w-full h-full absolute inset-0")}>
      <div style={twj("text-[80px] text-white font-black text-center mx-20")}>
        Takumi Playground
      </div>
    </div>
  </div>
</div>`;

