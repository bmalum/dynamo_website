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
        schema: `defmodule MyApp.Address do
  use Dynamo.Schema, embedded: true

  item do
    field :street, :string
    field :city, :string
    field :geo, {:list, :float}
  end
end

defmodule MyApp.Product do
  use Dynamo.Schema

  item do
    table "shop"

    field :category, :string, partition_key: true
    field :sku, :string, sort_key: true
    field :name, :string
    field :price, :decimal
    field :stock, :integer, default: 0
    field :tags, :string_set
    field :warehouse, MyApp.Address
  end
end`,
        crud: `alias MyApp.{Dynamo, Product, Address}

product = %Product{
  category: "electronics", sku: "phone-1", name: "Phone",
  price: Decimal.new("999.00"), tags: MapSet.new(["new"]),
  warehouse: %Address{city: "Berlin", geo: [52.5, 13.4]}
}

# create – fails with :conditional_check_failed if it exists
{:ok, product} = Dynamo.put(product, condition: [sku: :not_exists])

# read – embedded struct and Decimal come back typed
{:ok, %Product{warehouse: %Address{city: "Berlin"}}} =
  Dynamo.get(%Product{category: "electronics", sku: "phone-1"})

# update – SET / ADD / REMOVE built for you
{:ok, nil} =
  Dynamo.update(%Product{category: "electronics", sku: "phone-1"},
    stock: {:increment, 5},
    tags: {:add, MapSet.new(["sale"])}
  )

{:ok, nil} = Dynamo.delete(%Product{category: "electronics", sku: "phone-1"})`,
        query: `# one page, sort-key condition + typed filter
{:ok, %Dynamo.Page{items: items, last_evaluated_key: key}} =
  Dynamo.query(%Product{category: "electronics"},
    sort_key: {:begins_with, "laptop-"},
    filter: [price: {:gt, Decimal.new("200")}],
    descending: true,
    limit: 10
  )

# every page, bounded
{:ok, products} = Dynamo.query_all(%Product{category: "electronics"}, limit: 100)

# global secondary index – keys keep their field type
Dynamo.query(%Order{status: "shipped"},
  index: "StatusIndex",
  sort_key: {:gt, ~U[2024-01-01 00:00:00Z]}
)

# lazy stream; segments: N makes it a real parallel scan
Dynamo.stream(Product, segments: 4)
|> Stream.filter(&(&1.stock == 0))
|> Enum.count()`,
        batch: `# any number of items: chunked into 25, unprocessed retried with backoff
{:ok, %{unprocessed: []}} =
  Dynamo.batch_write([
    %Product{category: "books", sku: "b1", name: "Elixir", price: Decimal.new("29")},
    {:delete, %Product{category: "electronics", sku: "laptop-1"}}
  ])

{:ok, %{items: products}} =
  Dynamo.batch_get([%Product{category: "books", sku: "b1"}])

# atomic transfer with an idempotency token
{:ok, _} =
  Dynamo.transaction(
    [
      {:update, %Account{id: "src"}, [balance: {:decrement, 100}],
        condition: [balance: {:gte, 100}]},
      {:update, %Account{id: "dst"}, [balance: {:increment, 100}]},
      {:put, %Transfer{id: "t1", amount: 100}, condition: [id: :not_exists]}
    ],
    client_request_token: "transfer-t1"
  )

# on cancellation you get per-item reasons
# {:error, %Dynamo.Error{type: :transaction_canceled,
#          cancellation_reasons: [%{code: "ConditionalCheckFailed"}, ...]}}`,
        errors: `case Dynamo.put(user, condition: [pk: :not_exists]) do
  {:ok, user} ->
    {:ok, user}

  {:error, %Dynamo.Error{type: :conditional_check_failed}} ->
    {:error, :already_exists}

  {:error, %Dynamo.Error{retryable?: true}} ->
    retry_later()

  {:error, %Dynamo.Error{} = e} ->
    Logger.error(Exception.message(e))
end

# local validation happens before any request is sent
{:error, %Dynamo.Error{type: :validation_error}} = Dynamo.put(%User{})

# telemetry on every request
:telemetry.attach("dynamo", [:dynamo, :request, :stop],
  fn _, %{duration: d}, meta, _ ->
    ms = System.convert_time_unit(d, :native, :millisecond)
    Logger.debug("dynamo #{meta.action} #{meta.table} #{ms}ms #{meta.result}")
  end, nil)`
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
