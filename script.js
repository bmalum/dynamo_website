// Modern JavaScript for Dynamo Landing Page

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all interactive features
    initTabSwitching();
    initCopyButtons();
    initSmoothScrolling();
    initScrollEffects();
});

// Tab switching functionality
function initTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.example-tab');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            
            // Add active class to clicked button and corresponding tab
            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Copy to clipboard functionality
function initCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    
    copyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const codeType = button.getAttribute('data-code');
            const codeContent = getCodeContent(codeType);
            
            try {
                await navigator.clipboard.writeText(codeContent);
                showCopyFeedback(button);
            } catch (err) {
                console.error('Failed to copy code:', err);
                fallbackCopyTextToClipboard(codeContent, button);
            }
        });
    });
}

// Get code content based on type
function getCodeContent(type) {
    const codeSnippets = {
        schema: `defmodule MyApp.Product do
  use Dynamo.Schema

  item do
    table_name "products"
    
    field :category_id, partition_key: true
    field :product_id, sort_key: true
    field :name
    field :price
    field :stock, default: 0
    field :active, default: true
  end
end`,
        crud: `# Create
product = %MyApp.Product{
  category_id: "electronics",
  product_id: "smartphone-123",
  name: "iPhone 15",
  price: 999.99
}
{:ok, saved} = MyApp.Product.put_item(product)

# Read
{:ok, product} = MyApp.Product.get_item(%MyApp.Product{
  category_id: "electronics",
  product_id: "smartphone-123"
})

# List all products in category
{:ok, products} = MyApp.Product.list_items(
  %MyApp.Product{category_id: "electronics"}
)`,
        query: `# Query with conditions
{:ok, products} = MyApp.Product.list_items(
  %MyApp.Product{category_id: "electronics"},
  [
    sort_key: "smartphone",
    sk_operator: :begins_with,
    filter_expression: "price > :min_price",
    expression_attribute_values: %{
      ":min_price" => %{"N" => "500"}
    },
    scan_index_forward: false
  ]
)

# Parallel scan for large datasets
{:ok, all_products} = Dynamo.Table.parallel_scan(
  MyApp.Product,
  segments: 8
)`,
        batch: `# Batch write multiple items
products = [
  %MyApp.Product{category_id: "electronics", product_id: "phone-1", name: "iPhone", price: 999},
  %MyApp.Product{category_id: "electronics", product_id: "laptop-1", name: "MacBook", price: 1999},
  %MyApp.Product{category_id: "books", product_id: "book-1", name: "Elixir Guide", price: 29}
]

{:ok, result} = Dynamo.Table.batch_write_item(products)

# Transactions
Dynamo.Transaction.transact([
  {:update, %Account{id: "acc-1"}, %{balance: {:decrement, 100}}},
  {:update, %Account{id: "acc-2"}, %{balance: {:increment, 100}}}
])`
    };
    
    return codeSnippets[type] || '';
}

// Show copy feedback
function showCopyFeedback(button) {
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.style.background = '#10b981';
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '';
    }, 2000);
}

// Fallback copy function for older browsers
function fallbackCopyTextToClipboard(text, button) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopyFeedback(button);
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }
    
    document.body.removeChild(textArea);
}

// Smooth scrolling for navigation links
function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80; // Account for fixed nav
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Scroll effects and animations
function initScrollEffects() {
    // Navbar background on scroll
    const nav = document.querySelector('.nav');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.style.background = 'rgba(248, 250, 252, 0.95)';
            nav.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)';
        } else {
            nav.style.background = 'rgba(248, 250, 252, 0.8)';
            nav.style.boxShadow = 'none';
        }
    });
    
    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animateElements = document.querySelectorAll('.feature-card, .step, .section-header');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Add some interactive hover effects
document.addEventListener('DOMContentLoaded', function() {
    // Feature cards tilt effect
    const featureCards = document.querySelectorAll('.feature-card');
    
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        });
    });
    
    // Code preview hover effect
    const codePreview = document.querySelector('.code-preview');
    if (codePreview) {
        codePreview.addEventListener('mouseenter', () => {
            codePreview.style.transform = 'perspective(1000px) rotateY(-2deg) rotateX(2deg) scale(1.02)';
        });
        
        codePreview.addEventListener('mouseleave', () => {
            codePreview.style.transform = 'perspective(1000px) rotateY(-5deg) rotateX(5deg) scale(1)';
        });
    }
});

// Performance optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debouncing to scroll events
const debouncedScrollHandler = debounce(() => {
    // Any scroll-based animations or effects can go here
}, 10);

window.addEventListener('scroll', debouncedScrollHandler);

// Add loading animation - smooth fade in
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});
