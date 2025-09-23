// 浏览器环境下的数据加载器
class DataLoader {
    constructor() {
        this.quotes = [];
        this.votes = [];
        this.loaded = false;
    }

    async loadData() {
        try {
            console.log('[DataLoader] 开始加载主包JSON数据...');
            console.log('[DataLoader] 当前页面URL:', window.location.href);
            
            // 尝试加载主包的 Pilot dialogues.json
            const url = '/Pilot%20dialogues.json';
            console.log('[DataLoader] 请求URL:', url);
            
            const response = await fetch(url);
            console.log('[DataLoader] 响应状态:', response.status, response.statusText);
            console.log('[DataLoader] 响应头:', Object.fromEntries(response.headers.entries()));
            if (response.ok) {
                const jsonData = await response.json();
                console.log('[DataLoader] 成功加载主包JSON:', jsonData);
                
                if (jsonData.workQuotes && Array.isArray(jsonData.workQuotes)) {
                    this.quotes = jsonData.workQuotes.map((quote, index) => {
                        const processedQuote = {
                            id: quote.id,
                            content: {
                                zh: quote.content?.zh || quote.content || '',
                                en: quote.content?.en || ''
                            },
                            tags: quote.mood ? [quote.mood] : ['工作']
                        };
                        
                        // 详细日志前3条数据
                        if (index < 3) {
                            console.log(`[DataLoader] 处理语录 ${index + 1}:`, {
                                原始数据: quote,
                                处理后: processedQuote
                            });
                        }
                        
                        return processedQuote;
                    });
                    console.log('[DataLoader] 语录数据处理完成，数量:', this.quotes.length);
                    console.log('[DataLoader] 前3条语录预览:', this.quotes.slice(0, 3));
                }
                
                if (jsonData.voteTopics && Array.isArray(jsonData.voteTopics)) {
                    this.votes = jsonData.voteTopics;
                    console.log('[DataLoader] 投票数据加载完成，数量:', this.votes.length);
                }
                
                this.loaded = true;
                return true;
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('[DataLoader] 加载主包JSON失败:', error);
            
            // 回退：尝试加载包装模块的数据
            try {
                console.log('[DataLoader] 尝试回退加载...');
                const fallbackResponse = await fetch('../data/pilotDialogues.js');
                if (fallbackResponse.ok) {
                    const jsContent = await fallbackResponse.text();
                    // 这里需要解析JS文件内容，但在浏览器中比较复杂
                    console.warn('[DataLoader] JS文件回退加载需要特殊处理');
                }
            } catch (fallbackError) {
                console.error('[DataLoader] 回退加载也失败:', fallbackError);
            }
            
            // 使用兜底数据
            this.loadFallbackData();
            return false;
        }
    }

    loadFallbackData() {
        console.log('[DataLoader] 使用兜底数据');
        this.quotes = [
            { 
                content: { 
                    zh: "用离职的心态打工，真的一切都通了。", 
                    en: "Work with the mindset of being ready to leave — everything suddenly makes sense." 
                }, 
                tags: ["心态", "工作哲学"] 
            },
            { 
                content: { 
                    zh: "我的优秀，不需要你的PPT来证明。", 
                    en: "My excellence doesn't need your PPT to prove it." 
                }, 
                tags: ["自我价值", "反PUA"] 
            },
            { 
                content: { 
                    zh: "只要我不在乎薪水，老板就PUA不了我。", 
                    en: "As long as I don't care about salary, the boss can't manipulate me." 
                }, 
                tags: ["薪资", "反PUA"] 
            },
            { 
                content: { 
                    zh: "上班尽职尽责，但不必尽心尽力。", 
                    en: "Be responsible at work, but don't need to give your all." 
                }, 
                tags: ["工作态度", "边界感"] 
            },
            { 
                content: { 
                    zh: "完成，比完美更重要。", 
                    en: "Done is better than perfect." 
                }, 
                tags: ["效率", "工作方法"] 
            }
        ];

        this.votes = [
            {
                topic: "你更倾向于哪种工作方式？",
                optionA: "准时下班，工作生活分离",
                optionB: "适度加班，追求事业成就",
                tags: ["工作生活平衡"]
            },
            {
                topic: "面对职场PUA，你会选择？",
                optionA: "直接反驳，维护自己权益",
                optionB: "暂时忍耐，寻找合适时机",
                tags: ["反PUA", "职场智慧"]
            },
            {
                topic: "关于加班，你的态度是？",
                optionA: "坚决拒绝无意义加班",
                optionB: "为了团队配合偶尔加班",
                tags: ["加班", "工作态度"]
            }
        ];
        
        this.loaded = true;
    }

    getQuotes() {
        return this.quotes;
    }

    getVotes() {
        return this.votes;
    }

    isLoaded() {
        return this.loaded;
    }
}

// 导出给全局使用
window.DataLoader = DataLoader;