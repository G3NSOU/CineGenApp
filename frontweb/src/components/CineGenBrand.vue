<template>
  <span class="cinegen-brand" aria-label="CineGen">
    <img
      class="cinegen-brand__logo"
      src="/branding/cinegen-logo.png"
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  </span>
</template>

<style scoped>
.cinegen-brand {
  display: inline-flex;
  align-items: center;
  width: 154px;
  min-width: 154px;
  height: 42px;
  overflow: visible;
  white-space: nowrap;
}
.cinegen-brand__logo {
  display: block;
  width: 154px;
  height: 40px;
  object-fit: contain;
  object-position: left center;
  user-select: none;
  filter: drop-shadow(0 5px 13px rgba(5,6,6,.28));
  transform: translateZ(0) scale(1);
  transform-origin: 32% 50%;
  transition: filter var(--motion-standard) var(--motion-ease-out), transform var(--motion-standard) var(--motion-ease-out);
}
.cinegen-brand:hover .cinegen-brand__logo {
  filter:
    drop-shadow(0 5px 13px rgba(5,6,6,.22))
    drop-shadow(0 0 7px rgba(224,226,220,.34))
    drop-shadow(0 0 18px rgba(182,196,210,.18));
  transform: translateZ(0) scale(1.025);
}
@media (max-width: 720px) {
  .cinegen-brand { width: 124px; min-width: 124px; }
  .cinegen-brand__logo { width: 124px; height: 32px; }
}
@media (prefers-reduced-motion: reduce) {
  .cinegen-brand__logo { transition: filter var(--motion-fast) var(--motion-ease-out); }
  .cinegen-brand:hover .cinegen-brand__logo { transform: none; }
}
</style>
