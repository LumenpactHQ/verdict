import React from 'react';

interface VerdictLogoProps {
  className?: string;
  size?: number | string;
}

export const VerdictLogo: React.FC<VerdictLogoProps> = ({
  className = 'w-8 h-8',
  size,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1000 1000"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      shapeRendering="geometricPrecision"
      aria-label="Verdict Logo"
    >
      {/* 
        TOP FACE
        Hexagon upper peak with rounded corners, dipping in an organic U-curve at the base.
        Inside: Symmetrical, bold 'V' cutout with winged 45° angled tips pointing downward.
      */}
      <path
        d="M 472 175
           C 488 166, 512 166, 528 175
           L 668 255
           C 684 265, 690 285, 680 302
           C 650 365, 595 435, 500 435
           C 405 435, 350 365, 320 302
           C 310 285, 316 265, 332 255
           Z

           M 500 388
           L 620 262
           C 628 253, 626 238, 614 232
           L 582 216
           C 573 212, 562 216, 556 225
           L 500 296
           L 444 225
           C 438 216, 427 212, 418 216
           L 386 232
           C 374 238, 372 253, 380 262
           Z"
        fillRule="evenodd"
        clipRule="evenodd"
      />

      {/* 
        BOTTOM-LEFT FACE
        Outer hexagon left vertical edge and bottom-left angled base.
      */}
      <path
        d="M 308 322
           C 348 395, 408 456, 482 472
           C 486 476, 488 484, 488 495
           L 488 800
           C 488 815, 477 826, 462 820
           L 242 688
           C 228 680, 218 665, 218 648
           L 218 362
           C 218 345, 228 330, 242 322
           L 278 301
           C 292 293, 302 305, 308 322
           Z

           M 352 654
           L 236 434
           C 230 422, 237 406, 252 406
           L 288 406
           C 297 406, 305 412, 310 421
           L 352 524
           L 432 432
           C 440 422, 455 422, 463 432
           L 482 454
           C 490 464, 488 478, 478 488
           Z"
        fillRule="evenodd"
        clipRule="evenodd"
      />

      {/* 
        BOTTOM-RIGHT FACE
        Exact bilateral reflection across central vertical axis (X = 500).
      */}
      <path
        d="M 692 322
           C 652 395, 592 456, 518 472
           C 514 476, 512 484, 512 495
           L 512 800
           C 512 815, 523 826, 538 820
           L 758 688
           C 772 680, 782 665, 782 648
           L 782 362
           C 782 345, 772 330, 758 322
           L 722 301
           C 708 293, 698 305, 692 322
           Z

           M 648 654
           L 764 434
           C 770 422, 763 406, 748 406
           L 712 406
           C 703 406, 695 412, 690 421
           L 648 524
           L 568 432
           C 560 422, 545 422, 537 432
           L 518 454
           C 510 464, 512 478, 522 488
           Z"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
};
