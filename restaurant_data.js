const data = 
{
  "restaurants": [
    {
      "id": "sh_001",
      "name": "莆田餐厅",
      "type": "福建菜",
      "description": "",
      "priceLevel": 3,
      "tags": ["清淡", "海鲜", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "福建特色菜折扣"
        }
      ],
      "popularityScore": 0.82,
      "healthScore": 0.6,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_002",
      "name": "蓝蛙",
      "type": "西餐厅酒吧",
      "description": "",
      "priceLevel": 3,
      "tags": ["咸", "牛肉", "正餐", "同事聚餐", "堂食体验", "深夜营业"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京西路"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "汉堡买一送一"
        }
      ],
      "popularityScore": 0.8,
      "healthScore": 0.4,
      "spicyScore": 0.3,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_003",
      "name": "Baker&Spice",
      "type": "沙拉轻食",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "蔬菜", "鸡肉", "简餐", "一人食", "健康轻食", "高蛋白", "低碳水"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "沙拉套餐折扣"
        }
      ],
      "popularityScore": 0.75,
      "healthScore": 0.9,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_004",
      "name": "沃歌斯",
      "type": "沙拉轻食",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "蔬菜", "鸡肉", "简餐", "一人食", "健康轻食", "高蛋白", "低碳水"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "健康碗类特价"
        }
      ],
      "popularityScore": 0.78,
      "healthScore": 0.85,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_005",
      "name": "超级碗",
      "type": "健康轻食",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "蔬菜", "鸡肉", "简餐", "一人食", "健康轻食", "高蛋白", "低碳水", "外卖优选"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "高蛋白套餐优惠"
        }
      ],
      "popularityScore": 0.72,
      "healthScore": 0.88,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_006",
      "name": "陈香贵",
      "type": "兰州牛肉面",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "牛肉", "辣", "快餐", "一人食", "出餐快", "面条"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "牛肉面特价日"
        }
      ],
      "popularityScore": 0.85,
      "healthScore": 0.5,
      "spicyScore": 0.7,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_007",
      "name": "马记永",
      "type": "兰州牛肉面",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "牛肉", "辣", "快餐", "一人食", "出餐快", "面条"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["中山公园"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "面食买一送一"
        }
      ],
      "popularityScore": 0.83,
      "healthScore": 0.5,
      "spicyScore": 0.65,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_008",
      "name": "麦当劳",
      "type": "西式快餐",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "牛肉", "鸡肉", "快餐", "一人食",  "出餐快", "高热量"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "南京东路", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "超值星期一优惠"
        }
      ],
      "popularityScore": 0.9,
      "healthScore": 0.3,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_009",
      "name": "肯德基",
      "type": "西式快餐",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "鸡肉", "快餐", "一人食",  "出餐快", "高热量"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京西路", "静安寺", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "疯狂星期四特惠"
        }
      ],
      "popularityScore": 0.88,
      "healthScore": 0.3,
      "spicyScore": 0.3,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_010",
      "name": "汉堡王",
      "type": "西式快餐",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "牛肉", "快餐", "一人食",  "出餐快", "高热量"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "中山公园"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "国王日特惠"
        }
      ],
      "popularityScore": 0.82,
      "healthScore": 0.3,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_014",
      "name": "海底捞",
      "type": "火锅",
      "description": "",
      "priceLevel": 3,
      "tags": ["辣", "咸", "牛肉", "海鲜", "正餐", "同事聚餐", "深夜营业"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京东路", "五角场", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "学生优惠日"
        }
      ],
      "popularityScore": 0.89,
      "healthScore": 0.4,
      "spicyScore": 0.8,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_015",
      "name": "呷哺呷哺",
      "type": "火锅",
      "description": "",
      "priceLevel": 2,
      "tags": ["辣", "咸", "牛肉", "快餐", "一人食", "外卖优选"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "中山公园", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "套餐优惠日"
        }
      ],
      "popularityScore": 0.79,
      "healthScore": 0.4,
      "spicyScore": 0.7,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_016",
      "name": "和府捞面",
      "type": "中式面食",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "牛肉", "简餐", "一人食", "出餐快", "面条"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京西路", "陆家嘴", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "免费续面日"
        }
      ],
      "popularityScore": 0.77,
      "healthScore": 0.5,
      "spicyScore": 0.4,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_017",
      "name": "味千拉面",
      "type": "日式拉面",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "猪肉", "简餐", "一人食", "出餐快", "面条"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "中山公园", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "拉面特价日"
        }
      ],
      "popularityScore": 0.74,
      "healthScore": 0.4,
      "spicyScore": 0.3,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_018",
      "name": "一风堂",
      "type": "日式拉面",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "猪肉", "简餐", "一人食", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["静安寺", "南京西路"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 6,
          "promoText": "特色拉面优惠"
        }
      ],
      "popularityScore": 0.71,
      "healthScore": 0.4,
      "spicyScore": 0.3,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_019",
      "name": "鼎泰丰",
      "type": "台湾菜",
      "description": "",
      "priceLevel": 3,
      "tags": ["清淡", "猪肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "南京东路"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "小笼包特价"
        }
      ],
      "popularityScore": 0.76,
      "healthScore": 0.5,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_020",
      "name": "小杨生煎",
      "type": "上海小吃",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "猪肉", "小吃", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "南京东路", "徐家汇", "静安寺", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "生煎买四送一"
        }
      ],
      "popularityScore": 0.86,
      "healthScore": 0.3,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_021",
      "name": "南翔馒头店",
      "type": "上海小吃",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "猪肉", "小吃", "一人食", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["豫园"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "小笼包特价"
        }
      ],
      "popularityScore": 0.83,
      "healthScore": 0.4,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_022",
      "name": "新元素",
      "type": "沙拉轻食",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "蔬菜", "鸡肉", "简餐", "一人食", "健康轻食", "高蛋白", "低碳水"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["静安寺", "陆家嘴"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "沙拉买一送一"
        }
      ],
      "popularityScore": 0.76,
      "healthScore": 0.87,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_023",
      "name": "云海肴",
      "type": "云南菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["酸", "辣", "鸡肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["五角场", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "云南特色菜优惠"
        }
      ],
      "popularityScore": 0.79,
      "healthScore": 0.5,
      "spicyScore": 0.6,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_024",
      "name": "西贝莜面村",
      "type": "西北菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "牛肉", "羊肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["中山公园", "人民广场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 6,
          "promoText": "西北特色菜折扣"
        }
      ],
      "popularityScore": 0.81,
      "healthScore": 0.5,
      "spicyScore": 0.4,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_025",
      "name": "绿茶餐厅",
      "type": "浙菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "鸡肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["五角场", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "杭帮菜特价"
        }
      ],
      "popularityScore": 0.78,
      "healthScore": 0.6,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_026",
      "name": "外婆家",
      "type": "浙菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "猪肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京东路", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "家常菜优惠"
        }
      ],
      "popularityScore": 0.82,
      "healthScore": 0.5,
      "spicyScore": 0.3,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_027",
      "name": "南京大牌档",
      "type": "淮扬菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "鸭肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "南京小吃特价"
        }
      ],
      "popularityScore": 0.84,
      "healthScore": 0.5,
      "spicyScore": 0.3,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_028",
      "name": "望湘园",
      "type": "湘菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["辣", "咸", "猪肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["中山公园", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "湘菜特价日"
        }
      ],
      "popularityScore": 0.77,
      "healthScore": 0.4,
      "spicyScore": 0.8,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_029",
      "name": "蜀都丰",
      "type": "川菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["辣", "咸", "鱼肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "水煮鱼特价"
        }
      ],
      "popularityScore": 0.79,
      "healthScore": 0.4,
      "spicyScore": 0.85,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_030",
      "name": "太二酸菜鱼",
      "type": "川菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["酸", "辣", "鱼肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京西路", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 6,
          "promoText": "酸菜鱼优惠"
        }
      ],
      "popularityScore": 0.86,
      "healthScore": 0.4,
      "spicyScore": 0.8,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_031",
      "name": "江边城外",
      "type": "川菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["辣", "咸", "鱼肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "中山公园"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "烤鱼特价日"
        }
      ],
      "popularityScore": 0.81,
      "healthScore": 0.4,
      "spicyScore": 0.75,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_032",
      "name": "耶里夏丽",
      "type": "新疆菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "辣", "羊肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["静安寺", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "新疆大盘鸡特价"
        }
      ],
      "popularityScore": 0.78,
      "healthScore": 0.4,
      "spicyScore": 0.6,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_033",
      "name": "度小月",
      "type": "台湾菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "猪肉", "简餐", "一人食", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京东路", "陆家嘴"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "台湾小吃优惠"
        }
      ],
      "popularityScore": 0.75,
      "healthScore": 0.5,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_034",
      "name": "鹿港小镇",
      "type": "台湾菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["甜", "咸", "猪肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["徐家汇", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "台湾菜特价"
        }
      ],
      "popularityScore": 0.73,
      "healthScore": 0.4,
      "spicyScore": 0.3,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_035",
      "name": "避风塘",
      "type": "粤菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "海鲜", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "港式点心特价"
        }
      ],
      "popularityScore": 0.8,
      "healthScore": 0.5,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_036",
      "name": "唐宫",
      "type": "粤菜",
      "description": "",
      "priceLevel": 3,
      "tags": ["清淡", "海鲜", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 6,
          "promoText": "粤式早茶优惠"
        }
      ],
      "popularityScore": 0.82,
      "healthScore": 0.6,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_037",
      "name": "点都德",
      "type": "粤菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "猪肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["中山公园", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "广式点心特价"
        }
      ],
      "popularityScore": 0.84,
      "healthScore": 0.5,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_038",
      "name": "食其家",
      "type": "日式快餐",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "牛肉", "快餐", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京西路", "人民广场", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "牛丼饭特价"
        }
      ],
      "popularityScore": 0.77,
      "healthScore": 0.4,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_039",
      "name": "吉野家",
      "type": "日式快餐",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "牛肉", "快餐", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["静安寺", "中山公园", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "套餐优惠日"
        }
      ],
      "popularityScore": 0.75,
      "healthScore": 0.4,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_040",
      "name": "松屋",
      "type": "日式快餐",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "猪肉", "快餐", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "定食特价"
        }
      ],
      "popularityScore": 0.72,
      "healthScore": 0.4,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_041",
      "name": "丸龟制面",
      "type": "日式面食",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "猪肉", "快餐", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京东路", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "乌冬面特价"
        }
      ],
      "popularityScore": 0.74,
      "healthScore": 0.4,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_042",
      "name": "萨莉亚",
      "type": "意式简餐",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "奶酪", "简餐", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["五角场", "中山公园", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 6,
          "promoText": "意面特价"
        }
      ],
      "popularityScore": 0.73,
      "healthScore": 0.3,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_043",
      "name": "必胜客",
      "type": "西式简餐",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "奶酪", "简餐", "一人食",  "高热量"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "陆家嘴", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "披萨买一送一"
        }
      ],
      "popularityScore": 0.81,
      "healthScore": 0.3,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_044",
      "name": "达美乐",
      "type": "披萨",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "奶酪", "快餐", "一人食",  "高热量"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["五角场", "徐家汇", "中山公园"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "披萨7折优惠"
        }
      ],
      "popularityScore": 0.76,
      "healthScore": 0.3,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_045",
      "name": "棒约翰",
      "type": "披萨",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "奶酪", "简餐", "一人食",  "高热量"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京西路", "陆家嘴"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "套餐特价"
        }
      ],
      "popularityScore": 0.72,
      "healthScore": 0.3,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_046",
      "name": "麻辣诱惑",
      "type": "川湘菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["辣", "咸", "海鲜", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["静安寺", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "麻辣菜品特价"
        }
      ],
      "popularityScore": 0.78,
      "healthScore": 0.4,
      "spicyScore": 0.85,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_047",
      "name": "辛香汇",
      "type": "川菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["辣", "咸", "鸡肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "中山公园"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 6,
          "promoText": "川菜特价日"
        }
      ],
      "popularityScore": 0.82,
      "healthScore": 0.4,
      "spicyScore": 0.8,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_048",
      "name": "小南国",
      "type": "本帮菜",
      "description": "",
      "priceLevel": 3,
      "tags": ["甜", "咸", "猪肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "南京东路"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "本帮菜特价"
        }
      ],
      "popularityScore": 0.79,
      "healthScore": 0.5,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_049",
      "name": "老盛昌",
      "type": "上海小吃",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "猪肉", "小吃", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "静安寺", "五角场", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "汤包特价"
        }
      ],
      "popularityScore": 0.81,
      "healthScore": 0.4,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_050",
      "name": "吉祥馄饨",
      "type": "小吃",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "猪肉", "小吃", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["中山公园", "五角场", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "馄饨买一送一"
        }
      ],
      "popularityScore": 0.77,
      "healthScore": 0.4,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_051",
      "name": "阿香米线",
      "type": "米线",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "辣", "鸡肉", "简餐", "一人食", "外卖优选"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "徐家汇", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "米线特价"
        }
      ],
      "popularityScore": 0.79,
      "healthScore": 0.4,
      "spicyScore": 0.5,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_052",
      "name": "过桥米线",
      "type": "米线",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "清淡", "鸡肉", "简餐", "一人食", "外卖优选"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["中山公园", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "套餐优惠"
        }
      ],
      "popularityScore": 0.75,
      "healthScore": 0.5,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_053",
      "name": "汤先生",
      "type": "养生汤品",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "鸡肉", "简餐", "一人食",  "健康轻食"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "南京西路"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 6,
          "promoText": "养生汤品特价"
        }
      ],
      "popularityScore": 0.73,
      "healthScore": 0.8,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_054",
      "name": "谷田稻香",
      "type": "中式简餐",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "鸡肉", "简餐", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "五角场", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "瓦锅饭特价"
        }
      ],
      "popularityScore": 0.76,
      "healthScore": 0.5,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_055",
      "name": "大米先生",
      "type": "中式快餐",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "猪肉", "快餐", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["中山公园", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "套餐优惠"
        }
      ],
      "popularityScore": 0.74,
      "healthScore": 0.4,
      "spicyScore": 0.3,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_056",
      "name": "真功夫",
      "type": "中式快餐",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "鸡肉", "快餐", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "蒸菜特价"
        }
      ],
      "popularityScore": 0.72,
      "healthScore": 0.5,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_057",
      "name": "永和大王",
      "type": "中式快餐",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "猪肉", "快餐", "一人食",  "出餐快", "深夜营业"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["静安寺", "中山公园", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "豆浆油条特价"
        }
      ],
      "popularityScore": 0.78,
      "healthScore": 0.4,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_058",
      "name": "大娘水饺",
      "type": "小吃",
      "description": "",
      "priceLevel": 1,
      "tags": ["咸", "猪肉", "小吃", "一人食",  "出餐快"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["五角场", "人民广场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "水饺特价"
        }
      ],
      "popularityScore": 0.75,
      "healthScore": 0.4,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_064",
      "name": "新白鹿",
      "type": "浙菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "鸡肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "家常菜优惠"
        }
      ],
      "popularityScore": 0.81,
      "healthScore": 0.5,
      "spicyScore": 0.2,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_065",
      "name": "苏小柳",
      "type": "江南点心",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "猪肉", "小吃", "一人食", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "南京东路"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 6,
          "promoText": "江南点心特价"
        }
      ],
      "popularityScore": 0.78,
      "healthScore": 0.5,
      "spicyScore": 0.1,
     "basePreferenceScore": 5
    },
    {
      "id": "sh_066",
      "name": "蔡澜港式点心",
      "type": "粤菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "猪肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["静安寺", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "港式点心特价"
        }
      ],
      "popularityScore": 0.82,
      "healthScore": 0.5,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_067",
      "name": "添好运",
      "type": "粤菜",
      "description": "",
      "priceLevel": 2,
      "tags": ["清淡", "猪肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "中山公园"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "米其林点心特价"
        }
      ],
      "popularityScore": 0.79,
      "healthScore": 0.5,
      "spicyScore": 0.1,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_068",
      "name": "很久以前羊肉串",
      "type": "烧烤",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "辣", "羊肉", "正餐", "同事聚餐", "深夜营业"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["五角场", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "羊肉串特价"
        }
      ],
      "popularityScore": 0.81,
      "healthScore": 0.3,
      "spicyScore": 0.6,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_069",
      "name": "丰茂烤串",
      "type": "烧烤",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "辣", "羊肉", "正餐", "同事聚餐", "深夜营业"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "烤串套餐优惠"
        }
      ],
      "popularityScore": 0.77,
      "healthScore": 0.3,
      "spicyScore": 0.5,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_070",
      "name": "木屋烧烤",
      "type": "烧烤",
      "description": "",
      "priceLevel": 2,
      "tags": ["咸", "辣", "猪肉", "正餐", "同事聚餐", "深夜营业"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["中山公园", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "啤酒烧烤套餐"
        }
      ],
      "popularityScore": 0.75,
      "healthScore": 0.3,
      "spicyScore": 0.6,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_071",
      "name": "胡大饭店",
      "type": "川菜",
      "description": "",
      "priceLevel": 3,
      "tags": ["辣", "咸", "海鲜", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "南京西路"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 6,
          "promoText": "小龙虾特价"
        }
      ],
      "popularityScore": 0.84,
      "healthScore": 0.4,
      "spicyScore": 0.85,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_072",
      "name": "哥老官",
      "type": "火锅",
      "description": "",
      "priceLevel": 3,
      "tags": ["辣", "咸", "牛肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "美蛙鱼头特价"
        }
      ],
      "popularityScore": 0.86,
      "healthScore": 0.4,
      "spicyScore": 0.9,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_073",
      "name": "左庭右院",
      "type": "火锅",
      "description": "",
      "priceLevel": 3,
      "tags": ["清淡", "牛肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["静安寺", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "鲜牛肉特价"
        }
      ],
      "popularityScore": 0.82,
      "healthScore": 0.5,
      "spicyScore": 0.3,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_074",
      "name": "湊湊火锅",
      "type": "火锅",
      "description": "",
      "priceLevel": 3,
      "tags": ["辣", "咸", "牛肉", "正餐", "同事聚餐", "堂食体验", "深夜营业"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京东路", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "奶茶火锅套餐"
        }
      ],
      "popularityScore": 0.83,
      "healthScore": 0.4,
      "spicyScore": 0.7,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_075",
      "name": "巴奴毛肚火锅",
      "type": "火锅",
      "description": "",
      "priceLevel": 3,
      "tags": ["辣", "咸", "牛肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["陆家嘴", "中山公园"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 4,
          "promoText": "毛肚特价"
        }
      ],
      "popularityScore": 0.81,
      "healthScore": 0.4,
      "spicyScore": 0.8,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_076",
      "name": "大龙燚",
      "type": "火锅",
      "description": "",
      "priceLevel": 3,
      "tags": ["辣", "咸", "牛肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "静安寺"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 5,
          "promoText": "川味火锅特价"
        }
      ],
      "popularityScore": 0.79,
      "healthScore": 0.4,
      "spicyScore": 0.85,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_077",
      "name": "电台巷火锅",
      "type": "火锅",
      "description": "",
      "priceLevel": 3,
      "tags": ["辣", "咸", "牛肉", "正餐", "同事聚餐", "堂食体验", "深夜营业"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["五角场", "徐家汇"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 6,
          "promoText": "重庆火锅特价"
        }
      ],
      "popularityScore": 0.8,
      "healthScore": 0.4,
      "spicyScore": 0.9,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_078",
      "name": "小龙坎",
      "type": "火锅",
      "description": "",
      "priceLevel": 3,
      "tags": ["辣", "咸", "牛肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["南京西路", "中山公园"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 1,
          "promoText": "经典川锅特价"
        }
      ],
      "popularityScore": 0.82,
      "healthScore": 0.4,
      "spicyScore": 0.85,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_079",
      "name": "谭鸭血",
      "type": "火锅",
      "description": "",
      "priceLevel": 3,
      "tags": ["辣", "咸", "鸭血", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["静安寺", "五角场"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 2,
          "promoText": "鸭血火锅特价"
        }
      ],
      "popularityScore": 0.81,
      "healthScore": 0.4,
      "spicyScore": 0.8,
      "basePreferenceScore": 5
    },
    {
      "id": "sh_080",
      "name": "蜀大侠",
      "type": "火锅",
      "description": "",
      "priceLevel": 3,
      "tags": ["辣", "咸", "牛肉", "正餐", "同事聚餐", "堂食体验"],
      "location": {
        "city": ["上海"],
        "businessDistrict": ["人民广场", "陆家嘴"]
      },
      "dynamicPromotions": [
        {
          "type": "weekly",
          "dayOfWeek": 3,
          "promoText": "武侠主题火锅优惠"
        }
      ],
      "popularityScore": 0.8,
      "healthScore": 0.4,
      "spicyScore": 0.85,
      "basePreferenceScore": 5
    }

  ]
}
;
const pinyinMap = {
    "肯德基": "kendeji",
    "汉堡王": "hanbaowang",
    "Baker&Spice": "Baker&Spice",
    "超级碗": "chaojiwan",
    "陈香贵": "chenxianggui",
    "马记永": "majiyong",
    "沃歌斯": "wogesi",
    "海底捞": "haidilao",
    "呷哺呷哺": "xiabuxiabu",
    "莆田餐厅": "putiancanting",
    "蓝蛙": "lanwa",
    "星巴克": "xingbake",
    "喜茶": "xicha",
    "奈雪的茶": "naixuedecha",
    "和府捞面": "hefulaomian",
    "味千拉面": "weiqianlamian",
    "一风堂": "yifengtang",
    "鼎泰丰": "dingtaifeng",
    "小杨生煎": "xiaoyangshengjian",
    "南翔馒头店": "nanxiangmantoudian",
    "新元素": "xinyuansu",
    "云海肴": "yunhaiyao",
    "西贝莜面村": "xibeiyoumiancun",
    "绿茶餐厅": "lvchacanting",
    "外婆家": "waipojia",
    "南京大牌档": "nanjingdapaidang",
    "望湘园": "wangxiangyuan",
    "蜀都丰": "shudufeng",
    "太二酸菜鱼": "taiersuancaiyu",
    "江边城外": "jiangbianchengwai",
    "耶里夏丽": "yelixiali",
    "度小月": "duxiaoyue",
    "鹿港小镇": "lugangxiaozhen",
    "避风塘": "bifengtang",
    "唐宫": "tanggong",
    "点都德": "diandude",
    "食其家": "shiqijia",
    "吉野家": "jiyejia",
    "松屋": "songwu",
    "丸龟制面": "wanguizhimian",
    "萨莉亚": "saliya",
    "必胜客": "bishengke",
    "达美乐": "dameile",
    "棒约翰": "bangyuehan",
    "麻辣诱惑": "malayouhuo",
    "辛香汇": "xinxianghui",
    "小南国": "xiaonanguo",
    "老盛昌": "laoshengchang",
    "吉祥馄饨": "jixianghuntun",
    "阿香米线": "axiangmixian",
    "过桥米线": "guoqiaomixian",
    "汤先生": "tangxiansheng",
    "谷田稻香": "gutiandaoxiang",
    "大米先生": "damixiansheng",
    "真功夫": "zhenggongfu",
    "永和大王": "yonghedawang",
    "大娘水饺": "daniangshuijiao",
    "CoCo都可": "cocodouke",
    "一点点": "yidiandian",
    "乐乐茶": "lelecha",
    "7分甜": "qifentian",
    "桂满陇": "guimanlong",
    "新白鹿": "xinbailu",
    "苏小柳": "suxiaoliu",
    "蔡澜港式点心": "cailangangshidianxin",
    "添好运": "tianhaoyun",
    "很久以前羊肉串": "henjiuyiqianyangrouchuan",
    "丰茂烤串": "fengmaokaochuan",
    "木屋烧烤": "muwushaokao",
    "胡大饭店": "hudafandian",
    "哥老官": "gelaoguan",
    "左庭右院": "zuotingyouyuan",
    "湊湊火锅": "coucouhuoguo",
    "巴奴毛肚火锅": "banumaoduhuoguo",
    "大龙燚": "dalongyi",
    "电台巷火锅": "diantaixianghuoguo",
    "小龙坎": "xiaolongkan",
    "谭鸭血": "tanyaxie",
    "蜀大侠": "shudaxia",
    "麦当劳": "maidanglao"
};
// 引入云图片管理器
const { cloudImageManager } = require('./utils/cloudImageManager.js');

if (typeof data !== 'undefined' && data && Array.isArray(data.restaurants)) {
  data.restaurants = data.restaurants.map(item => {
    const slug = (typeof pinyinMap === 'object' && pinyinMap) ? pinyinMap[item.name] : null;
    // 使用云图片管理器获取图片URL
    item.logoUrl = cloudImageManager.getCloudImageUrl(slug || 'placeholder');
    return item;
  });
}
module.exports = data;
