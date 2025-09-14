// components/loading/loading.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 是否显示loading
    show: {
      type: Boolean,
      value: false
    },
    // loading文本
    text: {
      type: String,
      value: '加载中...'
    },
    // loading类型：default, dots, spinner
    type: {
      type: String,
      value: 'default'
    },
    // 背景遮罩透明度
    opacity: {
      type: Number,
      value: 0.7
    },
    // 是否显示背景遮罩
    mask: {
      type: Boolean,
      value: true
    }
  },

  /**
   * 组件的初始数据
   */
  data: {

  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 阻止遮罩层事件冒泡
    preventTap() {
      return false
    }
  }
})