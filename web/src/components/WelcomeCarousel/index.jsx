import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Users, UserPlus } from 'lucide-react';
import welcome1 from '../../assets/welcome_v2_1.png';
import welcome2 from '../../assets/welcome_v2_2.png';
import welcome3 from '../../assets/welcome_v2_3.png';

const slides = [
  {
    id: 1,
    title: "Trải nghiệm xuyên suốt",
    description: "Kết nối và trò chuyện cùng người thân, bạn bè được tối ưu hóa cho máy tính của bạn.",
    image: welcome1,
    accent: "from-indigo-600/30 to-blue-600/30",
    glow: "bg-indigo-500/20"
  },
  {
    id: 2,
    title: "Gửi File nặng?",
    description: "Khám phá những tiện ích hỗ trợ làm việc và chia sẻ file dung lượng lớn không giới hạn.",
    image: welcome2,
    accent: "from-blue-600/30 to-cyan-600/30",
    glow: "bg-blue-500/20"
  },
  {
    id: 3,
    title: "Bảo mật & Riêng tư",
    description: "Tin nhắn của bạn luôn được bảo vệ an toàn với hệ thống mã hóa và bảo mật tiên tiến.",
    image: welcome3,
    accent: "from-purple-600/30 to-pink-600/30",
    glow: "bg-purple-500/20"
  }
];

const WelcomeCarousel = ({ user, onAction }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const nextSlide = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const prevSlide = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  useEffect(() => {
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-background transition-colors duration-500 overflow-y-auto no-scrollbar">
      {/* Ambient background glows */}
      <div className={`absolute top-1/4 -left-20 w-[600px] h-[600px] ${slides[currentSlide].glow} opacity-20 blur-[120px] rounded-full transition-all duration-1000 pointer-events-none`} />
      <div className={`absolute bottom-1/4 -right-20 w-[600px] h-[600px] ${slides[currentSlide].glow} opacity-20 blur-[120px] rounded-full transition-all duration-1000 pointer-events-none`} style={{ animationDelay: '1s' }} />

      <div className="relative z-10 w-full min-h-full flex flex-col items-center justify-center p-6 md:p-12 text-center">
        {/* Header */}
        <div className="mb-6 md:mb-10 animate-slide-up">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Chào mừng, <span className="text-blue-600">{user?.fullName || 'bạn'}</span> đến với ChatApp!
          </h1>
          <p className="text-foreground/40 mt-1 md:mt-2 font-medium text-sm md:text-base">Khám phá những tiện ích tuyệt vời dành riêng cho bạn</p>
        </div>

        {/* Carousel Content */}
        <div className="relative w-full max-w-4xl flex items-center justify-center mb-4 min-h-[300px] md:min-h-[400px]">
          {/* Navigation Buttons - Hidden on very small screens */}
          <button
            onClick={prevSlide}
            className="absolute left-0 z-20 p-2 md:p-2.5 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/40 backdrop-blur-md border border-foreground/5 transition-all active:scale-90 hidden sm:flex"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={nextSlide}
            className="absolute right-0 z-20 p-2 md:p-2.5 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/40 backdrop-blur-md border border-foreground/5 transition-all active:scale-90 hidden sm:flex"
          >
            <ChevronRight size={20} />
          </button>

          {/* Slides Container */}
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden py-4">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-in-out transform ${index === currentSlide
                    ? 'opacity-100 translate-x-0 scale-100'
                    : index < currentSlide
                      ? 'opacity-0 -translate-x-12 scale-95'
                      : 'opacity-0 translate-x-12 scale-95'
                  }`}
              >
                {/* Refined Image Container */}
                <div className="relative mb-4 md:mb-6">
                  <div className={`absolute inset-0 bg-gradient-to-br ${slide.accent} rounded-full blur-xl transform scale-110 opacity-50`} />

                  <div className="relative w-[150px] h-[150px] md:w-[200px] md:h-[200px] rounded-full overflow-hidden border border-border/50 shadow-lg bg-surface-100/50 backdrop-blur-sm flex items-center justify-center">
                    <img
                      src={slide.image}
                      alt={slide.title}
                      className="w-full h-full object-cover animate-float"
                    />
                  </div>
                </div>

                <div className="space-y-2 max-w-lg px-4 animate-slide-up">
                  <h3 className="text-lg md:text-xl font-bold text-foreground">
                    {slide.title}
                  </h3>
                  <p className="text-foreground/50 text-[13px] md:text-[14px] font-medium leading-relaxed">
                    {slide.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination Dots */}
        <div className="flex items-center space-x-2 mb-8 md:mb-10">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`transition-all duration-500 rounded-full ${index === currentSlide ? 'w-8 h-1.5 bg-blue-600' : 'w-1.5 h-1.5 bg-foreground/10'
                }`}
            />
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <button
            onClick={() => onAction('createGroup')}
            className="flex items-center space-x-2 px-4 md:px-6 py-2.5 md:py-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20 hover:-translate-y-0.5 transition-all active:scale-95 text-sm md:text-base font-bold"
          >
            <Users size={18} />
            <span>Tạo nhóm mới</span>
          </button>
          <button
            onClick={() => onAction('addFriend')}
            className="flex items-center space-x-2 px-4 md:px-6 py-2.5 md:py-3 bg-surface-200 border border-border rounded-xl text-foreground hover:-translate-y-0.5 transition-all active:scale-95 text-sm md:text-base font-bold"
          >
            <UserPlus size={18} />
            <span>Thêm bạn bè</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCarousel;
