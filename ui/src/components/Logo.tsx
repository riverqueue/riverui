export default function Logo(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg
      aria-hidden="true"
      width="151"
      height="84"
      viewBox="0 0 151 84"
      fill="none"
      aria-label="River logo"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clipPath="url(#clip0_6_2)">
        <path
          d="M41.2888 64C48.512 64 55.1494 64.5538 61.2012 65.6615C67.4482 66.6769 73.4024 67.9231 79.0637 69.4C84.9203 70.7846 90.7769 72.0308 96.6335 73.1385C102.685 74.1538 109.03 74.6615 115.667 74.6615C121.524 74.6615 126.697 74.0615 131.187 72.8615C135.873 71.6615 139.484 69.5846 142.022 66.6308L147 67.3231C146.219 70.3692 143.876 73 139.972 75.2154C136.068 77.3385 131.09 79 125.038 80.2C119.181 81.4 112.739 82 105.711 82C98.4881 82 91.753 81.4923 85.506 80.4769C79.4542 79.3692 73.5 78.1231 67.6434 76.7385C61.9821 75.2615 56.2231 74.0154 50.3665 73C44.51 71.8923 38.1653 71.3385 31.3327 71.3385C25.4761 71.3385 20.3028 71.9385 15.8127 73.1385C11.3227 74.3385 7.71116 76.4154 4.97809 79.3692L0 78.6769C0.780877 75.6308 3.12351 73.0461 7.02789 70.9231C10.9323 68.7077 15.9104 67 21.9622 65.8C28.0139 64.6 34.4562 64 41.2888 64Z"
          fill="currentColor"
        />
        <path
          d="M1.99466 49V2.45454H19.4492C23.025 2.45454 26.025 3.07576 28.4492 4.31818C30.8886 5.5606 32.7295 7.30303 33.9719 9.54545C35.2295 11.7727 35.8583 14.3712 35.8583 17.3409C35.8583 20.3258 35.2219 22.9167 33.9492 25.1136C32.6916 27.2955 30.8356 28.9848 28.381 30.1818C25.9265 31.3636 22.9113 31.9545 19.3356 31.9545H6.90375V24.9545H18.1992C20.2901 24.9545 22.0022 24.6667 23.3356 24.0909C24.6689 23.5 25.6537 22.6439 26.2901 21.5227C26.9416 20.3864 27.2674 18.9924 27.2674 17.3409C27.2674 15.6894 26.9416 14.2803 26.2901 13.1136C25.6386 11.9318 24.6462 11.0379 23.3128 10.4318C21.9795 9.81061 20.2598 9.5 18.1537 9.5H10.4265V49H1.99466ZM26.0401 27.9091L37.5628 49H28.1537L16.8356 27.9091H26.0401ZM41.976 49V14.0909H50.2033V49H41.976ZM46.1124 9.13636C44.8094 9.13636 43.6881 8.70455 42.7487 7.84091C41.8094 6.96212 41.3397 5.90909 41.3397 4.68182C41.3397 3.43939 41.8094 2.38636 42.7487 1.52272C43.6881 0.643937 44.8094 0.204544 46.1124 0.204544C47.4306 0.204544 48.5518 0.643937 49.476 1.52272C50.4154 2.38636 50.8851 3.43939 50.8851 4.68182C50.8851 5.90909 50.4154 6.96212 49.476 7.84091C48.5518 8.70455 47.4306 9.13636 46.1124 9.13636ZM88.5653 14.0909L76.1335 49H67.0426L54.6108 14.0909H63.3835L71.4062 40.0227H71.7699L79.8153 14.0909H88.5653ZM107.246 49.6818C103.746 49.6818 100.723 48.9545 98.1774 47.5C95.6471 46.0303 93.7001 43.9545 92.3365 41.2727C90.9728 38.5758 90.291 35.4015 90.291 31.75C90.291 28.1591 90.9728 25.0076 92.3365 22.2955C93.7153 19.5682 95.6395 17.447 98.1092 15.9318C100.579 14.4015 103.48 13.6364 106.814 13.6364C108.965 13.6364 110.996 13.9848 112.905 14.6818C114.829 15.3636 116.526 16.4242 117.996 17.8636C119.48 19.303 120.647 21.1364 121.496 23.3636C122.344 25.5758 122.768 28.2121 122.768 31.2727V33.7955H94.1547V28.25H114.882C114.867 26.6742 114.526 25.2727 113.859 24.0455C113.193 22.803 112.261 21.8258 111.064 21.1136C109.882 20.4015 108.503 20.0455 106.927 20.0455C105.246 20.0455 103.768 20.4545 102.496 21.2727C101.223 22.0758 100.23 23.1364 99.5183 24.4545C98.8213 25.7576 98.4653 27.1894 98.4501 28.75V33.5909C98.4501 35.6212 98.8213 37.3636 99.5638 38.8182C100.306 40.2576 101.344 41.3636 102.677 42.1364C104.011 42.8939 105.571 43.2727 107.359 43.2727C108.556 43.2727 109.64 43.1061 110.609 42.7727C111.579 42.4242 112.42 41.9167 113.132 41.25C113.844 40.5833 114.382 39.7576 114.746 38.7727L122.427 39.6364C121.943 41.6667 121.018 43.4394 119.655 44.9545C118.306 46.4545 116.579 47.6212 114.473 48.4545C112.367 49.2727 109.958 49.6818 107.246 49.6818ZM128.449 49V14.0909H136.426V19.9091H136.789C137.426 17.8939 138.517 16.3409 140.062 15.25C141.623 14.1439 143.403 13.5909 145.403 13.5909C145.858 13.5909 146.365 13.6136 146.926 13.6591C147.502 13.6894 147.979 13.7424 148.358 13.8182V21.3864C148.009 21.2652 147.456 21.1591 146.699 21.0682C145.956 20.9621 145.236 20.9091 144.539 20.9091C143.039 20.9091 141.691 21.2348 140.494 21.8864C139.312 22.5227 138.38 23.4091 137.699 24.5455C137.017 25.6818 136.676 26.9924 136.676 28.4773V49H128.449Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="clip0_6_2">
          <rect width="151" height="84" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
