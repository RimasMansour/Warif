export const guides = {
  ar: {
    masterGuide: {
      title: "دليل وارِف الشامل",
      sections: [
        {
          id: "dashboard",
          title: "لوحة التحكم والمراقبة",
          content: "الصفحة الرئيسية تجمع كل شيء في مكان واحد: مركز قيادة التوأم الرقمي في الأعلى يوضح حالة الأجهزة والمعدات، وأربع بطاقات سريعة تعرض بيانات المناخ والتربة والري والتوصيات في الوقت الفعلي. بطاقة التنبيهات على اليمين ترصد أي اختلالات تلقائياً وتوصي بالإجراء المناسب."
        },
        {
          id: "automation",
          title: "وضع التلقائي مقابل اليدوي",
          content: "زر التبديل في أعلى الشريط الجانبي يتحكم في نمط تشغيل المزرعة. في وضع التلقائي، يدير النظام المضخات والتبريد بناءً على تحليل البيانات اللحظية دون أي تدخل. في وضع اليدوي، تصبح جميع أزرار التحكم متاحة لك في صفحات المناخ والري لإدارة المعدات بنفسك."
        },
        {
          id: "sensors",
          title: "المناخ والتربة",
          content: "صفحة المناخ والتهوية تعرض درجة حرارة الهواء ورطوبته وشدة الإضاءة مع رسوم بيانية تاريخية تغطي يوماً أو أسبوعاً أو شهراً. صفحة بيئة وصحة التربة تراقب حرارة التربة ورطوبتها وتعرض حالة المحاصيل المزروعة. كلتا الصفحتين توفران توصيات ذكية مرتبطة بالقراءات الحية."
        },
        {
          id: "irrigation",
          title: "إدارة الري والموارد",
          content: "صفحة الري توضح حالة تدفق المياه لحظياً، وتتيح تشغيل المضخات يدوياً أو إيقافها، مع رسم بياني يتتبع استهلاك المياه والكهرباء عبر الزمن. بطاقتا الاستهلاك اليومي تعرضان إجمالي المياه والطاقة المستهلكة اليوم مقارنةً بالأمس."
        },
        {
          id: "xai",
          title: "التوصيات والذكاء الاصطناعي التفسيري",
          content: "صفحة التوصيات والقرارات الذكية تعرض توصيات النظام مقسمةً إلى قسمَي 'المشكلة' و'الحل' لكل توصية. يمكنك تنفيذها أو تجاهلها، وتقييم مدى دقتها بأزرار التقييم. هذه التقييمات تُرسل مباشرةً للنموذج لتحسين دقة التوصيات مستقبلاً."
        }
      ]
    }
  },
  en: {
    masterGuide: {
      title: "Warif System Guide",
      sections: [
        {
          id: "dashboard",
          title: "Monitoring & Control Center",
          content: "The home page brings everything together: the Digital Twin Command Center at the top shows device and equipment status, while four glance cards display real-time climate, soil, irrigation, and recommendation data. The Alerts card on the right automatically detects anomalies and recommends the appropriate action."
        },
        {
          id: "automation",
          title: "Auto vs. Manual Mode",
          content: "The toggle at the top of the sidebar controls the farm's operating mode. In Auto mode, the system manages pumps and cooling based on live data analysis without any intervention. In Manual mode, all control buttons in the Climate and Irrigation pages become available so you can operate equipment yourself."
        },
        {
          id: "sensors",
          title: "Climate & Soil Pages",
          content: "The Climate & Ventilation page shows air temperature, humidity, and light intensity with historical charts covering a day, week, or month. The Soil & Crop Health page monitors soil temperature and moisture and displays the status of planted crops. Both pages provide smart recommendations linked to live sensor readings."
        },
        {
          id: "irrigation",
          title: "Irrigation & Resource Management",
          content: "The Irrigation page shows real-time water flow status and allows manual pump start or stop, with a chart tracking water and power consumption over time. The two daily consumption cards show total water and energy used today compared to yesterday."
        },
        {
          id: "xai",
          title: "Recommendations & Explainable AI",
          content: "The Decision Support page displays system recommendations split into an 'Issue' and a 'Solution' section for each item. You can execute or ignore them, and rate their accuracy using the feedback buttons. These ratings are sent directly to the model to improve recommendation accuracy over time."
        }
      ]
    }
  }
};
