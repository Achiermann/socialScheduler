"use client";
import { useEffect, useId, useRef, useState } from "react";

// Smartphone in Linien (Stil wie der Shaker), weisser Rahmen, schwarzer Bildschirm.
// Klein als Icon, gross als Rahmen fuer die Reels-Vorschau - beide gleich gezeichnet,
// nur die Linienstaerke unterscheidet sich (CSS).
// Bildschirm im viewBox: x 7-93, y 7-193 (siehe .phone-screen)
// screen: optionales Bild im Bildschirm (Icon zeigt das Vorschaubild, wie gross das Video)
export function PhoneSvg({ big = false, screen, ...rest }) {
  const clip = useId();
  return (
    <svg viewBox="0 0 100 200" fill="none" stroke="var(--ink)" strokeLinecap="round" strokeLinejoin="round"
      className={big ? "phone-svg big" : "phone-svg"} aria-hidden="true" {...rest}>
      <rect x="2" y="2" width="96" height="196" rx="16" fill="var(--card)" />
      <rect x="7" y="7" width="86" height="186" rx="12" fill="#000" />
      {screen && (
        <>
          <clipPath id={clip}><rect x="7" y="7" width="86" height="186" rx="12" /></clipPath>
          <image href={screen} x="7" y="7" width="86" height="186" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
          <rect x="38" y="12" width="24" height="7" rx="3.5" fill="#000" stroke="none" />
        </>
      )}
      <path d="M1 42v10M1 58v14M99 56v20" />
    </svg>
  );
}

// Instagram-Symbole, nachgezeichnet als weisse Linien
const I = {
  heart: <path d="M12 20s-7.5-4.6-9.2-9.1C1.5 7.6 3.5 4.2 7 4.2c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.5 0 5.5 3.4 4.2 6.7C19.5 15.4 12 20 12 20z" />,
  comment: <path d="M20.6 16.8A9 9 0 1 0 17 20.1L21 21z" />,
  repost: <path d="M17 2.5l3 3-3 3M4 11.5v-1.5a4.5 4.5 0 0 1 4.5-4.5H20M7 21.5l-3-3 3-3M20 12.5v1.5a4.5 4.5 0 0 1-4.5 4.5H4" />,
  send: <path d="M21.5 2.5L2.5 9.5l8 3.5 3.5 8zM21.5 2.5l-11 10.5" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3" />,
  camera: <><rect x="2.5" y="5.5" width="19" height="15" rx="4" /><circle cx="12" cy="13" r="4" /><path d="M8.5 5.5l1.5-2.5h4l1.5 2.5" /></>,
  chevron: <path d="M6 9l6 6 6-6" />,
  home: <path d="M3 10.5L12 3l9 7.5V21h-6v-6.5H9V21H3z" />,
  search: <><circle cx="10.5" cy="10.5" r="7" /><path d="M16 16l5 5" /></>,
  plus: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 8v8M8 12h8" /></>,
  reels: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M3 8.5h18M9 3l2.5 5.5M15 3l2.5 5.5M10 12v6l5-3z" /></>,
  note: <><path d="M9 18V5l10-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  play: <path d="M8 5v14l11-7z" fill="#fff" />,
};
const Icon = ({ name, size = "1em" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[name]}</svg>
);

let profileCache = null; // einmal pro Seitenaufruf laden

// Reels-Vorschau: Video + Instagram-Oberflaeche im grossen Smartphone.
// Klick ausserhalb des Smartphones oder Escape schliesst.
export function PhonePreview({ post, videoSrc, onClose }) {
  const [profile, setProfile] = useState(profileCache);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (profileCache) return;
    fetch("/api/ig-profile").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.username) { profileCache = d; setProfile(d); }
    }).catch(() => {});
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }

  const username = profile?.username || "dein.account";
  const avatar = profile?.picture
    ? <img className="ig-avatar" src={profile.picture} alt="" />
    : <span className="ig-avatar" />;
  const caption = (post.caption || "").trim();

  return (
    <div className="phone-overlay" onClick={onClose}>
      <div className="phone-big" role="dialog" aria-label={`Instagram-Vorschau ${post.filename}`} onClick={(e) => e.stopPropagation()}>
        <PhoneSvg big />
        <div className="phone-screen">
        <div className="ig">
          <video
            ref={videoRef}
            className="ig-video"
            src={videoSrc}
            poster={`/api/thumb?path=${encodeURIComponent(post.dropbox_path)}`}
            autoPlay
            loop
            playsInline
            onClick={togglePlay}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
          />
          <div className="ig-shade" />
          {paused && <button className="ig-paused" onClick={togglePlay} aria-label="Abspielen"><Icon name="play" size="100%" /></button>}

          <div className="ig-status"><span>9:41</span><span className="ig-island" /><span className="ig-battery" /></div>
          <div className="ig-top">
            <span className="ig-title">Reels <Icon name="chevron" size="0.8em" /></span>
            <Icon name="camera" size="1.6em" />
          </div>

          <div className="ig-actions">
            <Icon name="heart" size="1.75em" />
            <Icon name="comment" size="1.6em" />
            <Icon name="repost" size="1.6em" />
            <Icon name="send" size="1.6em" />
            <Icon name="more" size="1.6em" />
            <span className="ig-audio-cover">{profile?.picture && <img src={profile.picture} alt="" />}</span>
          </div>

          <div className="ig-meta">
            <div className="ig-user">{avatar}<b>{username}</b><span className="ig-follow">Folgen</span></div>
            {caption && (
              <div className={"ig-caption" + (expanded ? " open" : "")} onClick={() => setExpanded((x) => !x)}>
                {caption}
              </div>
            )}
            <div className="ig-audio"><Icon name="note" size="0.95em" /> {username} · Originalaudio</div>
          </div>

          <div className="ig-progress"><span style={{ width: `${progress * 100}%` }} /></div>
          <nav className="ig-nav">
            <Icon name="home" size="1.6em" />
            <Icon name="search" size="1.6em" />
            <Icon name="plus" size="1.6em" />
            <Icon name="reels" size="1.6em" />
            {profile?.picture ? <img className="ig-nav-avatar" src={profile.picture} alt="" /> : <span className="ig-nav-avatar" />}
          </nav>
        </div>
        </div>
      </div>
    </div>
  );
}
