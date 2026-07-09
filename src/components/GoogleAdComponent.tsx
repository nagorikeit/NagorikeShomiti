import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, X, Play, AlertCircle, Sparkles, ExternalLink } from "lucide-react";

interface GoogleAdComponentProps {
  type: "banner" | "video";
  companyPlan: "free" | "monthly" | "yearly";
}

// Interactive Simulated Ad Content
const AD_CAMPAIGNS = [
  {
    title: "বিকাশ অ্যাপ ডাউনলোড করুন",
    description: "সহজ ও নিরাপদ লেনদেনের জন্য আজই ডাউনলোড করুন বিকাশ অ্যাপ। ফ্রি সেন্ড মানি এবং ক্যাশব্যাক অফার উপভোগ করুন!",
    imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1d704d3?auto=format&fit=crop&w=600&q=80",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-businesswoman-analyzing-charts-on-a-tablet-40436-large.mp4",
    ctaText: "অ্যাপ ডাউনলোড করুন",
    link: "https://www.bkash.com",
    advertiser: "bKash Limited"
  },
  {
    title: "ট্যাপ ট্যাপ সেন্ড - প্রবাসীদের সেরা অ্যাপ",
    description: "ইউকে, ইউএসএ বা ইউরোপ থেকে বাংলাদেশে সম্পূর্ণ ফ্রিতে ও সর্বোচ্চ রেটে টাকা পাঠান মুহূর্তের মধ্যে!",
    imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-smartphone-with-a-yellow-background-41484-large.mp4",
    ctaText: "টাকা পাঠান এখনই",
    link: "https://www.taptapsend.com",
    advertiser: "Taptap Send"
  },
  {
    title: "ডিজিটাল খাতা প্রো - ব্যবসার সঠিক হিসাব",
    description: "আপনার ক্ষুদ্র ও মাঝারি ব্যবসার সম্পূর্ণ দেনা-পাওনা ও ক্যাশ হিসাব রাখুন একটি নিরাপদ ক্লাউড প্ল্যাটফর্মে।",
    imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-person-typing-on-a-laptop-keyboard-41586-large.mp4",
    ctaText: "ফ্রি রেজিস্ট্রেশন",
    link: "#",
    advertiser: "Digital Khata Ltd."
  }
];

export default function GoogleAdComponent({ type, companyPlan }: GoogleAdComponentProps) {
  // If subscriber, never show any ads
  if (companyPlan !== "free") {
    return null;
  }

  const [campaign, setCampaign] = useState(AD_CAMPAIGNS[0]);
  const [closed, setClosed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeLeft, setTimeLeft] = useState(15);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pick a random campaign on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * AD_CAMPAIGNS.length);
    setCampaign(AD_CAMPAIGNS[randomIndex]);
  }, []);

  // Handle countdown for video ads
  useEffect(() => {
    if (type !== "video" || closed || !isPlaying) return;

    if (timeLeft <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [type, closed, isPlaying, timeLeft]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(videoRef.current.muted);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (closed) return null;

  return (
    <div className="w-full font-sans animate-fadeIn">
      {type === "banner" ? (
        /* ================= BANNER AD STYLE ================= */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs relative overflow-hidden flex flex-col md:flex-row items-center gap-4">
          {/* Ad Label */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <span>Ads by Google</span>
            <AlertCircle className="w-3 h-3 text-slate-400" />
            <button 
              onClick={() => setClosed(true)} 
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer text-slate-400 hover:text-slate-600"
              title="বিজ্ঞাপন বন্ধ করুন"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Ad Creative Image */}
          <div className="w-full md:w-24 h-20 shrink-0 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60">
            <img 
              src={campaign.imageUrl} 
              alt={campaign.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Ad Details */}
          <div className="flex-1 text-center md:text-left space-y-1 pr-6">
            <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
              {campaign.advertiser}
            </div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">
              {campaign.title}
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
              {campaign.description}
            </p>
          </div>

          {/* CTA Button */}
          <a 
            href={campaign.link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto shrink-0 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black rounded-2xl text-center transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10 cursor-pointer"
          >
            {campaign.ctaText}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        /* ================= COMPACT NON-OBTRUSIVE VIDEO AD STYLE ================= */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl space-y-3 relative font-sans">
          {/* Ad Label & Header Controls */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">স্পন্সরড ভিডিও</span>
              <span className="text-[10px] text-slate-400 font-bold">Google AdManager</span>
            </div>
            <div className="flex items-center gap-2">
              {timeLeft > 0 ? (
                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                  বিজ্ঞাপন শেষ হবেঃ {timeLeft} সেকেন্ড
                </span>
              ) : (
                <button
                  onClick={() => setClosed(true)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition cursor-pointer flex items-center gap-1 text-[9px] font-extrabold"
                >
                  <X className="w-3.5 h-3.5" /> বিজ্ঞাপন বন্ধ করুন
                </button>
              )}
            </div>
          </div>

          {/* Interactive Video Canvas */}
          <div className="relative aspect-video bg-black flex items-center justify-center group overflow-hidden">
            <video
              ref={videoRef}
              src={campaign.videoUrl}
              autoPlay
              muted={muted}
              loop
              playsInline
              className="w-full h-full object-cover"
              onClick={handlePlayPause}
            />

            {/* Video overlay controls */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-100 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-between">
              {/* Play Pause State indicator */}
              <div className="self-end">
                <button 
                  onClick={toggleMute}
                  className="p-2 bg-black/60 hover:bg-black/85 text-white rounded-xl transition cursor-pointer border border-white/10"
                >
                  {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>

              {/* Bottom Details & CTA Overlay */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <span className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-widest">{campaign.advertiser}</span>
                  <h4 className="text-xs font-black text-white leading-tight">{campaign.title}</h4>
                  <p className="text-[10px] text-slate-300 leading-normal line-clamp-1 font-semibold">{campaign.description}</p>
                </div>
                
                <div className="flex items-center justify-between gap-4 pt-1">
                  {/* Action CTA link */}
                  <a 
                    href={campaign.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-xl transition flex items-center gap-1 shadow-md shadow-indigo-600/30 cursor-pointer"
                  >
                    <span>{campaign.ctaText}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {/* Play Button Indicator */}
                  <button 
                    onClick={handlePlayPause}
                    className="p-1.5 text-slate-400 hover:text-white transition text-[9px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {isPlaying ? (
                      <><span>বিরতি দিন</span></>
                    ) : (
                      <><Play className="w-3 h-3 text-emerald-400 fill-emerald-400" /> <span>চালু করুন</span></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
