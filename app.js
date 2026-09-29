// ============================================================
// Lavenders — منطق الموقع الرئيسي
// ============================================================

const app = {
  categories: [],
  currentUser: null,
  favoriteIds: new Set(),
  darkMode: localStorage.getItem('lavenders_dark') === '1',

  // ---------------- تهيئة عامة ----------------
  async init(){
    await this.loadCategories();
    this.renderMenuCategories();
    this.updateCartBadge();
    const { data:{ session } } = await supabaseClient.auth.getSession();
    this.currentUser = session ? session.user : null;
    await this.loadFavoriteIds();
    supabaseClient.auth.onAuthStateChange((_event, session)=>{
      this.currentUser = session ? session.user : null;
    });
    window.addEventListener('hashchange', ()=>this.router());
    this.router();
  },

  async loadFavoriteIds(){
    if(!this.currentUser){ this.favoriteIds = new Set(); return; }
    const { data } = await supabaseClient.from('favorites').select('product_id').eq('customer_id', this.currentUser.id);
    this.favoriteIds = new Set((data||[]).map(f=>f.product_id));
  },

  async toggleFavorite(productId, btnEl){
    if(!this.currentUser){ location.hash = '#/login'; return; }
    const isFav = this.favoriteIds.has(productId);
    if(isFav){
      this.favoriteIds.delete(productId);
      await supabaseClient.from('favorites').delete()
        .eq('customer_id', this.currentUser.id).eq('product_id', productId);
    } else {
      this.favoriteIds.add(productId);
      await supabaseClient.from('favorites').insert({ customer_id:this.currentUser.id, product_id:productId });
    }
    if(btnEl){ btnEl.textContent = isFav ? '♡' : '♥'; }
    if(location.hash === '#/favorites' && isFav) this.renderFavorites();
  },

  async loadCategories(){
    const { data, error } = await supabaseClient
      .from('categories').select('*').order('sort_order');
    if(!error) this.categories = data;
  },

  renderMenuCategories(){
    const box = document.getElementById('menuCategoryList');
    let html = `
      <a class="cat-chip" style="display:block;margin-bottom:8px;" href="#/all" onclick="app.toggleMenu()">جميع المنتجات</a>
      <a class="cat-chip" style="display:block;margin-bottom:8px;" href="#/discounts" onclick="app.toggleMenu()">خصومات 🔥</a>
    `;
    this.categories.forEach(c=>{
      html += `<a class="cat-chip" style="display:block;margin-bottom:8px;" href="#/category/${c.slug}" onclick="app.toggleMenu()">${c.name}</a>`;
    });
    box.innerHTML = html;
  },

  // ---------------- التوجيه بين الصفحات ----------------
  router(){
    const hash = location.hash || '#/';
    const page = document.getElementById('pageContent');
    page.scrollTo?.(0,0);
    window.scrollTo(0,0);

    this.updateNavActive(hash);

    if(hash === '#/' ) return this.renderHome();
    if(hash === '#/all') return this.renderProducts({ all:true }, 'جميع المنتجات');
    if(hash === '#/discounts') return this.renderProducts({ discounts:true }, 'الخصومات 🔥');
    if(hash.startsWith('#/category/')) {
      const slug = hash.split('/')[2];
      const cat = this.categories.find(c=>c.slug===slug);
      return this.renderProducts({ categoryId: cat?.id }, cat?.name || 'القسم');
    }
    if(hash.startsWith('#/product/')) return this.renderProductDetail(hash.split('/')[2]);
    if(hash === '#/login') return this.renderLogin();
    if(hash === '#/account') return this.renderAccount();
    if(hash === '#/account/profile') return this.renderProfile();
    if(hash === '#/account/orders') return this.renderOrdersPage();
    if(hash === '#/favorites') return this.renderFavorites();
    if(hash === '#/addresses') return this.renderAddresses();
    if(hash === '#/checkout') return this.renderCheckout();
    return this.renderHome();
  },

  updateNavActive(hash){
    const map = {
      '#/': 'navHome',
      '#/all': 'navAll',
      '#/discounts': 'navDiscounts',
      '#/account': 'navAccount',
      '#/account/profile': 'navAccount',
      '#/account/orders': 'navAccount',
      '#/favorites': 'navAccount',
      '#/addresses': 'navAccount',
    };
    ['navHome','navAll','navDiscounts','navAccount','navCart'].forEach(id=>{
      document.getElementById(id)?.classList.remove('active');
    });
    const active = map[hash] || (hash.startsWith('#/category/') ? 'navAll' : null);
    if(active) document.getElementById(active)?.classList.add('active');
  },

  // ---------------- الصفحة الرئيسية ----------------
  renderHome(){
    let catCards = this.categories.map(c=>`
      <a href="#/category/${c.slug}" class="cat-card">${c.name}</a>
    `).join('');

    document.getElementById('pageContent').innerHTML = `
      <div class="section-title">تسوقي حسب القسم</div>
      <div class="cat-grid">${catCards}</div>
      <div class="section-title">أحدث المنتجات</div>
      <div id="homeProducts" class="product-grid"><p class="empty-msg">جاري التحميل...</p></div>
    `;
    this.loadProductsInto('homeProducts', { all:true, limit:12 });
  },

  // ---------------- صفحة منتجات (قسم / الكل / خصومات) ----------------
  async renderProducts(filter, title){
    document.getElementById('pageContent').innerHTML = `
      <div class="section-title">${title}</div>
      <div class="cat-scroll">
        <a href="#/all" class="cat-chip ${filter.all?'active':''}">الكل</a>
        <a href="#/discounts" class="cat-chip ${filter.discounts?'active':''}">خصومات</a>
        ${this.categories.map(c=>`<a href="#/category/${c.slug}" class="cat-chip ${filter.categoryId===c.id?'active':''}">${c.name}</a>`).join('')}
      </div>
      <div id="prodList" class="product-grid"><p class="empty-msg">جاري التحميل...</p></div>
    `;
    this.loadProductsInto('prodList', filter);
  },

  async loadProductsInto(elId, filter){
    let q = supabaseClient.from('products').select('*').eq('is_active', true);
    if(filter.categoryId) q = q.eq('category_id', filter.categoryId);
    if(filter.discounts) q = q.not('compare_at_price','is', null);
    if(filter.limit) q = q.limit(filter.limit);
    q = q.order('created_at', { ascending:false });

    const { data, error } = await q;
    const box = document.getElementById(elId);
    if(error || !data || data.length===0){
      box.innerHTML = `<p class="empty-msg">ماكو منتجات هسه بهذا القسم</p>`;
      return;
    }
    box.innerHTML = data.map(p=>this.productCard(p)).join('');
  },

  productCard(p){
    const hasDiscount = p.compare_at_price && p.compare_at_price > p.price;
    const outOfStock = p.stock <= 0;
    const isFav = this.favoriteIds.has(p.id);
    return `
      <div class="product-card">
        <button class="fav-btn" onclick="event.preventDefault(); app.toggleFavorite('${p.id}', this)">${isFav ? '♥' : '♡'}</button>
        <a href="#/product/${p.id}">
          <img src="${p.image_url || 'https://via.placeholder.com/300x300?text=Lavenders'}" alt="${p.name}">
        </a>
        <div class="product-info">
          <a href="#/product/${p.id}"><p class="product-name">${p.name}</p></a>
          ${p.brand ? `<p class="product-brand">${p.brand}</p>` : ''}
          <div class="price-row">
            <span class="price">${this.money(p.price)}</span>
            ${hasDiscount ? `<span class="old-price">${this.money(p.compare_at_price)}</span>` : ''}
          </div>
          ${outOfStock ? `<p class="stock-note">نفدت الكمية</p>` : ''}
          <button class="add-btn" ${outOfStock?'disabled':''} onclick="app.addToCart('${p.id}')">
            ${outOfStock ? 'غير متوفر' : 'أضف للسلة'}
          </button>
        </div>
      </div>
    `;
  },

  money(v){ return Number(v).toLocaleString('ar-IQ') + ' د.ع'; },

  // ---------------- صفحة تفاصيل المنتج ----------------
  async renderProductDetail(id){
    document.getElementById('pageContent').innerHTML = `<p class="empty-msg">جاري التحميل...</p>`;
    const { data:p, error } = await supabaseClient.from('products').select('*').eq('id', id).single();
    if(error || !p){
      document.getElementById('pageContent').innerHTML = `<p class="empty-msg">المنتج غير موجود</p>`;
      return;
    }
    const hasDiscount = p.compare_at_price && p.compare_at_price > p.price;
    const outOfStock = p.stock <= 0;
    const isFav = this.favoriteIds.has(p.id);
    document.getElementById('pageContent').innerHTML = `
      <div class="product-detail" style="position:relative;">
        <button class="fav-btn" style="top:26px;" onclick="app.toggleFavorite('${p.id}', this)">${isFav ? '♥' : '♡'}</button>
        <img src="${p.image_url || 'https://via.placeholder.com/500x500?text=Lavenders'}" alt="${p.name}">
        <h1>${p.name}</h1>
        ${p.brand ? `<p class="product-brand">${p.brand}</p>` : ''}
        <div class="price-row" style="margin-top:8px;">
          <span class="price" style="font-size:18px;">${this.money(p.price)}</span>
          ${hasDiscount ? `<span class="old-price">${this.money(p.compare_at_price)}</span>` : ''}
        </div>
        ${p.description ? `<p class="desc">${p.description}</p>` : ''}
        ${outOfStock
          ? `<p class="stock-note">عذراً، نفدت الكمية من هذا المنتج حالياً</p>`
          : `
            <div class="qty-row">
              <button onclick="app.changeQty(-1)">−</button>
              <span id="qtyVal">1</span>
              <button onclick="app.changeQty(1)">+</button>
            </div>
            <button class="primary-btn" onclick="app.addToCart('${p.id}', true)">أضف للسلة</button>
          `}
      </div>
    `;
    this._tempQty = 1;
  },

  changeQty(delta){
    this._tempQty = Math.max(1, (this._tempQty||1) + delta);
    document.getElementById('qtyVal').textContent = this._tempQty;
  },

  // ---------------- السلة (localStorage) ----------------
  getCart(){ return JSON.parse(localStorage.getItem('lavenders_cart') || '{}'); },
  saveCart(cart){ localStorage.setItem('lavenders_cart', JSON.stringify(cart)); this.updateCartBadge(); },

  async addToCart(productId, fromDetail){
    const { data:p } = await supabaseClient.from('products').select('*').eq('id', productId).single();
    if(!p || p.stock <= 0) return;
    const qty = fromDetail ? (this._tempQty || 1) : 1;
    const cart = this.getCart();
    const existingQty = cart[productId] ? cart[productId].qty : 0;
    const newQty = Math.min(existingQty + qty, p.stock);
    cart[productId] = { name:p.name, price:p.price, image_url:p.image_url, qty:newQty, stock:p.stock };
    this.saveCart(cart);
    this.openCart();
  },

  removeFromCart(productId){
    const cart = this.getCart();
    delete cart[productId];
    this.saveCart(cart);
    this.renderCartDrawer();
  },

  updateCartBadge(){
    const cart = this.getCart();
    const count = Object.values(cart).reduce((s,i)=>s+i.qty,0);
    const badge = document.getElementById('cartBadge');
    if(count>0){ badge.style.display='flex'; badge.textContent = count; }
    else badge.style.display='none';
  },

  renderCartDrawer(){
    const cart = this.getCart();
    const box = document.getElementById('cartItemsBox');
    const ids = Object.keys(cart);
    if(ids.length===0){
      box.innerHTML = `<p class="empty-msg">سلتك فارغة</p>`;
      document.getElementById('cartTotal').textContent = this.money(0);
      return;
    }
    let total = 0;
    box.innerHTML = ids.map(id=>{
      const it = cart[id];
      total += it.price * it.qty;
      return `
        <div class="cart-item">
          <img src="${it.image_url || 'https://via.placeholder.com/60'}">
          <div class="info">
            <div class="name">${it.name}</div>
            <div class="price">${this.money(it.price)} × ${it.qty}</div>
          </div>
          <button class="remove-btn" onclick="app.removeFromCart('${id}')">حذف</button>
        </div>
      `;
    }).join('');
    document.getElementById('cartTotal').textContent = this.money(total);
  },

  openCart(){
    this.renderCartDrawer();
    document.getElementById('cartOverlay').classList.add('open');
    document.getElementById('cartDrawer').classList.add('open');
  },
  closeCart(){
    document.getElementById('cartOverlay').classList.remove('open');
    document.getElementById('cartDrawer').classList.remove('open');
  },

  goCheckout(){
    if(Object.keys(this.getCart()).length===0) return;
    this.closeCart();
    location.hash = '#/checkout';
  },

  // ---------------- تسجيل الدخول / إنشاء حساب ----------------
  renderLogin(){
    document.getElementById('pageContent').innerHTML = `
      <div class="page-wrap">
        <h2>تسجيل الدخول</h2>
        <div id="authMsg"></div>
        <div class="form-field"><label>الإيميل</label><input id="authEmail" type="email"></div>
        <div class="form-field"><label>كلمة السر</label><input id="authPass" type="password"></div>
        <button class="primary-btn" onclick="app.doLogin()">دخول</button>
        <button class="secondary-btn" onclick="app.doSignup()">حساب جديد؟ سجل الآن</button>
      </div>
    `;
  },

  async doLogin(){
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPass').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    const msg = document.getElementById('authMsg');
    if(error){ msg.innerHTML = `<p class="form-msg error">${this.arError(error.message)}</p>`; return; }
    this.currentUser = data.user;
    await this.loadFavoriteIds();
    location.hash = '#/account';
  },

  async doSignup(){
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPass').value;
    const msg = document.getElementById('authMsg');
    if(!email || password.length < 6){
      msg.innerHTML = `<p class="form-msg error">اكتب إيميل صحيح وكلمة سر لا تقل عن 6 أحرف</p>`;
      return;
    }
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if(error){ msg.innerHTML = `<p class="form-msg error">${this.arError(error.message)}</p>`; return; }
    msg.innerHTML = `<p class="form-msg success">تم إنشاء الحساب، سجل دخولك الآن</p>`;
  },

  arError(m){
    if(m.includes('Invalid login')) return 'الإيميل أو كلمة السر غير صحيحة';
    if(m.includes('already registered')) return 'هذا الإيميل مسجل مسبقاً، سجل دخولك';
    return m;
  },

  async logout(){
    await supabaseClient.auth.signOut();
    location.hash = '#/';
  },

  // ---------------- حسابي (القائمة الرئيسية) ----------------
  renderAccount(){
    const loggedIn = !!this.currentUser;
    const row = (icon, title, sub, onclick) => `
      <div class="settings-row" onclick="${onclick}">
        <span class="chevron">‹</span>
        <div class="row-right">
          <div class="row-text">
            <div class="row-title">${title}</div>
            ${sub ? `<div class="row-sub">${sub}</div>` : ''}
          </div>
          <div class="icon-box">${icon}</div>
        </div>
      </div>
    `;

    document.getElementById('pageContent').innerHTML = `
      <div class="page-wrap">
        ${loggedIn
          ? row('👤','بياناتي','', "location.hash='#/account/profile'")
          : row('👤','تسجيل الدخول','', "location.hash='#/login'")
        }
        ${row('🛍️','الطلبات السابقة','', loggedIn ? "location.hash='#/account/orders'" : "location.hash='#/login'")}
        ${row('♡','المفضلة','', loggedIn ? "location.hash='#/favorites'" : "location.hash='#/login'")}
        ${row('🌐','لغة التطبيق','العربية', "app.showLangNote()")}
        ${row('🎧','اتصل بنا 24/7','تواصل معنا', `app.openWhatsApp('مرحباً، عندي استفسار')`)}
        <div class="settings-row">
          <button class="toggle-switch ${this.darkMode?'on':''}" onclick="app.toggleDarkMode(this)"><span class="dot"></span></button>
          <div class="row-right">
            <div class="row-text">
              <div class="row-title">الوضع الليلي</div>
              <div class="row-sub" id="darkModeSub">${this.darkMode?'مفعل':'غير مفعل'}</div>
            </div>
            <div class="icon-box">🌙</div>
          </div>
        </div>
        ${row('📍','العناوين المحفوظة','', loggedIn ? "location.hash='#/addresses'" : "location.hash='#/login'")}
        ${loggedIn ? `<button class="secondary-btn" onclick="app.logout()">تسجيل خروج</button>` : ''}
      </div>
    `;
  },

  showLangNote(){ alert('التطبيق حالياً متوفر باللغة العربية بس'); },

  toggleDarkMode(btn){
    this.darkMode = !this.darkMode;
    localStorage.setItem('lavenders_dark', this.darkMode ? '1' : '0');
    btn.classList.toggle('on', this.darkMode);
    document.getElementById('darkModeSub').textContent = this.darkMode ? 'مفعل' : 'غير مفعل';
  },

  // ---------------- بياناتي (تعديل الاسم) ----------------
  async renderProfile(){
    if(!this.currentUser){ location.hash='#/login'; return; }
    const { data: customer } = await supabaseClient
      .from('customers').select('*').eq('id', this.currentUser.id).maybeSingle();

    document.getElementById('pageContent').innerHTML = `
      <div class="page-wrap">
        <h2>بياناتي</h2>
        <div id="accMsg"></div>
        <div class="form-field"><label>الاسم الكامل</label><input id="accName" value="${customer?.full_name||''}"></div>
        <div class="form-field"><label>الإيميل</label><input value="${this.currentUser.email}" disabled></div>
        <button class="primary-btn" onclick="app.saveProfile()">حفظ البيانات</button>
      </div>
    `;
  },

  async saveProfile(){
    const full_name = document.getElementById('accName').value.trim();
    const msg = document.getElementById('accMsg');
    if(!full_name){ msg.innerHTML = `<p class="form-msg error">اكتب اسمك</p>`; return; }
    const { error } = await supabaseClient.from('customers').upsert({ id:this.currentUser.id, full_name });
    msg.innerHTML = error
      ? `<p class="form-msg error">صار خطأ، حاول مرة ثانية</p>`
      : `<p class="form-msg success">انحفظت بياناتك</p>`;
  },

  // ---------------- طلباتي ----------------
  renderOrdersPage(){
    if(!this.currentUser){ location.hash='#/login'; return; }
    document.getElementById('pageContent').innerHTML = `
      <div class="page-wrap">
        <h2>طلباتي</h2>
        <div id="ordersList"><p class="empty-msg">جاري التحميل...</p></div>
      </div>
    `;
    this.loadOrders();
  },

  async loadOrders(){
    const { data: orders } = await supabaseClient
      .from('orders').select('*, order_items(*)')
      .eq('customer_id', this.currentUser.id)
      .order('created_at', { ascending:false });

    const box = document.getElementById('ordersList');
    if(!orders || orders.length===0){
      box.innerHTML = `<p class="empty-msg">ماكو طلبات لسه</p>`;
      return;
    }
    box.innerHTML = orders.map(o=>`
      <div class="order-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="order-status">${o.status}</span>
          <span style="font-size:12px;color:var(--muted);">${new Date(o.created_at).toLocaleDateString('ar-IQ')}</span>
        </div>
        <p style="margin:10px 0 6px;font-size:13px;">
          ${o.order_items.map(it=>`${it.product_name} × ${it.quantity}`).join('، ')}
        </p>
        <p style="font-weight:700;">${this.money(o.total)}</p>
      </div>
    `).join('');
  },

  // ---------------- المفضلة ----------------
  async renderFavorites(){
    if(!this.currentUser){ location.hash='#/login'; return; }
    document.getElementById('pageContent').innerHTML = `
      <div class="section-title">المفضلة</div>
      <div id="favList" class="product-grid"><p class="empty-msg">جاري التحميل...</p></div>
    `;
    const ids = Array.from(this.favoriteIds);
    const box = document.getElementById('favList');
    if(ids.length===0){ box.innerHTML = `<p class="empty-msg">ماكو منتجات بالمفضلة لسه</p>`; return; }
    const { data } = await supabaseClient.from('products').select('*').in('id', ids);
    box.innerHTML = (data && data.length) ? data.map(p=>this.productCard(p)).join('') : `<p class="empty-msg">ماكو منتجات بالمفضلة لسه</p>`;
  },

  // ---------------- العناوين المحفوظة ----------------
  async renderAddresses(){
    if(!this.currentUser){ location.hash='#/login'; return; }
    document.getElementById('pageContent').innerHTML = `
      <div class="page-wrap">
        <h2>العناوين المحفوظة</h2>
        <div id="addrMsg"></div>
        <div id="addrList"><p class="empty-msg">جاري التحميل...</p></div>

        <h3 style="margin-top:22px;font-size:15px;">إضافة عنوان جديد</h3>
        <div class="form-field"><label>اسم العنوان (مثال: المنزل، العمل)</label><input id="newAddrLabel" value="المنزل"></div>
        <div class="form-field"><label>الاسم الكامل</label><input id="newAddrName"></div>
        <div class="form-field"><label>رقم الهاتف</label><input id="newAddrPhone"></div>
        <div class="form-field"><label>العنوان بالتفصيل</label><textarea id="newAddrText" rows="2"></textarea></div>
        <button class="primary-btn" onclick="app.addAddress()">إضافة العنوان</button>
      </div>
    `;
    this.loadAddresses();
  },

  async loadAddresses(){
    const { data } = await supabaseClient.from('addresses').select('*')
      .eq('customer_id', this.currentUser.id).order('is_default', { ascending:false });
    const box = document.getElementById('addrList');
    if(!data || data.length===0){ box.innerHTML = `<p class="empty-msg">ماكو عناوين محفوظة لسه</p>`; return; }
    box.innerHTML = data.map(a=>`
      <div class="addr-card">
        <span class="addr-label">${a.label}</span>
        ${a.is_default ? `<span class="default-badge">افتراضي</span>` : ''}
        <p style="font-size:13px;margin:8px 0 2px;">${a.full_name} — ${a.phone}</p>
        <p style="font-size:13px;color:#444;">${a.address}</p>
        <div style="display:flex;gap:8px;margin-top:8px;">
          ${!a.is_default ? `<button class="mini-btn" onclick="app.setDefaultAddress('${a.id}')">اجعله افتراضي</button>` : ''}
          <button class="mini-btn danger" onclick="app.deleteAddress('${a.id}')">حذف</button>
        </div>
      </div>
    `).join('');
  },

  async addAddress(){
    const label = document.getElementById('newAddrLabel').value.trim() || 'المنزل';
    const full_name = document.getElementById('newAddrName').value.trim();
    const phone = document.getElementById('newAddrPhone').value.trim();
    const address = document.getElementById('newAddrText').value.trim();
    const msg = document.getElementById('addrMsg');
    if(!full_name || !phone || !address){
      msg.innerHTML = `<p class="form-msg error">عبي الاسم والرقم والعنوان كلهن</p>`;
      return;
    }
    const { count } = await supabaseClient.from('addresses').select('*', { count:'exact', head:true }).eq('customer_id', this.currentUser.id);
    const { error } = await supabaseClient.from('addresses').insert({
      customer_id: this.currentUser.id, label, full_name, phone, address, is_default: (count===0)
    });
    if(error){ msg.innerHTML = `<p class="form-msg error">صار خطأ: ${error.message}</p>`; return; }
    msg.innerHTML = `<p class="form-msg success">انضاف العنوان</p>`;
    ['newAddrName','newAddrPhone','newAddrText'].forEach(id=>document.getElementById(id).value='');
    this.loadAddresses();
  },

  async setDefaultAddress(id){
    await supabaseClient.from('addresses').update({ is_default:false }).eq('customer_id', this.currentUser.id);
    await supabaseClient.from('addresses').update({ is_default:true }).eq('id', id);
    this.loadAddresses();
  },

  async deleteAddress(id){
    if(!confirm('حذف هذا العنوان؟')) return;
    await supabaseClient.from('addresses').delete().eq('id', id);
    this.loadAddresses();
  },

  // ---------------- إتمام الطلب ----------------
  renderCheckout(){
    if(!this.currentUser){
      document.getElementById('pageContent').innerHTML = `
        <div class="page-wrap">
          <p class="empty-msg">لازم تسجل دخولك حتى تكمل الطلب</p>
          <a href="#/login"><button class="primary-btn">تسجيل الدخول</button></a>
        </div>
      `;
      return;
    }
    const cart = this.getCart();
    if(Object.keys(cart).length===0){
      document.getElementById('pageContent').innerHTML = `<p class="empty-msg">سلتك فارغة</p>`;
      return;
    }

    supabaseClient.from('addresses').select('*').eq('customer_id', this.currentUser.id).order('is_default', { ascending:false })
      .then(({data:addresses})=>{
        let total = 0;
        const itemsHtml = Object.values(cart).map(it=>{
          total += it.price*it.qty;
          return `<p style="font-size:13px;">${it.name} × ${it.qty} — ${this.money(it.price*it.qty)}</p>`;
        }).join('');

        const hasAddresses = addresses && addresses.length>0;

        document.getElementById('pageContent').innerHTML = `
          <div class="page-wrap">
            <h2>إتمام الطلب</h2>
            <div id="checkoutMsg"></div>
            ${itemsHtml}
            <p class="cart-total" style="border:none;"><span>الإجمالي</span><span>${this.money(total)}</span></p>

            ${hasAddresses ? `
              <div class="form-field">
                <label>اختار عنوان التوصيل</label>
                <select id="coAddrSelect" onchange="app.onAddrSelectChange()">
                  ${addresses.map(a=>`<option value="${a.id}" data-name="${a.full_name}" data-phone="${a.phone}" data-address="${a.address}">${a.label} — ${a.full_name}</option>`).join('')}
                  <option value="new">+ عنوان جديد</option>
                </select>
              </div>
            ` : ''}

            <div id="manualAddrFields" style="${hasAddresses ? 'display:none;' : ''}">
              <div class="form-field"><label>الاسم الكامل</label><input id="coName"></div>
              <div class="form-field"><label>رقم الهاتف</label><input id="coPhone"></div>
              <div class="form-field"><label>العنوان بالتفصيل</label><textarea id="coAddr" rows="2"></textarea></div>
            </div>

            <p style="font-size:12px;color:var(--muted);">الدفع عند الاستلام 💵</p>
            <button class="primary-btn" id="placeOrderBtn" onclick="app.submitOrder()">تأكيد الطلب</button>
          </div>
        `;

        if(hasAddresses){
          const def = addresses[0];
          document.getElementById('coName') && (document.getElementById('coName').value = def.full_name);
        }
      });
  },

  onAddrSelectChange(){
    const sel = document.getElementById('coAddrSelect');
    const box = document.getElementById('manualAddrFields');
    if(sel.value === 'new'){
      box.style.display = 'block';
      box.innerHTML = `
        <div class="form-field"><label>الاسم الكامل</label><input id="coName"></div>
        <div class="form-field"><label>رقم الهاتف</label><input id="coPhone"></div>
        <div class="form-field"><label>العنوان بالتفصيل</label><textarea id="coAddr" rows="2"></textarea></div>
      `;
    } else {
      box.style.display = 'none';
    }
  },

  async submitOrder(){
    const sel = document.getElementById('coAddrSelect');
    let full_name, phone, address;
    if(sel && sel.value !== 'new'){
      const opt = sel.options[sel.selectedIndex];
      full_name = opt.dataset.name; phone = opt.dataset.phone; address = opt.dataset.address;
    } else {
      full_name = document.getElementById('coName').value.trim();
      phone = document.getElementById('coPhone').value.trim();
      address = document.getElementById('coAddr').value.trim();
    }
    const msg = document.getElementById('checkoutMsg');

    if(!full_name || !phone || !address){
      msg.innerHTML = `<p class="form-msg error">عبي الاسم والرقم والعنوان كلهن</p>`;
      return;
    }

    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true; btn.textContent = 'جاري إرسال الطلب...';

    const cart = this.getCart();
    const items = Object.keys(cart).map(id=>({ product_id:id, quantity:cart[id].qty }));

    const { data, error } = await supabaseClient.rpc('place_order', {
      p_full_name: full_name, p_phone: phone, p_address: address, p_items: items
    });

    if(error){
      msg.innerHTML = `<p class="form-msg error">${error.message.includes('كافية') ? error.message : 'صار خطأ: ' + error.message}</p>`;
      btn.disabled = false; btn.textContent = 'تأكيد الطلب';
      return;
    }

    localStorage.removeItem('lavenders_cart');
    this.updateCartBadge();

    const orderSummary = Object.values(cart).map(it=>`${it.name} ×${it.qty}`).join('، ');
    const waMsg = `طلب جديد ✅%0Aالاسم: ${full_name}%0Aالرقم: ${phone}%0Aالعنوان: ${address}%0Aالمنتجات: ${orderSummary}`;

    document.getElementById('pageContent').innerHTML = `
      <div class="page-wrap">
        <p class="form-msg success">تم إرسال طلبك بنجاح 🎉 رقم الطلب: ${data}</p>
        <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}" target="_blank">
          <button class="primary-btn">أرسلي تفاصيل الطلب عبر واتساب</button>
        </a>
        <a href="#/"><button class="secondary-btn">رجوع للمتجر</button></a>
      </div>
    `;
  },

  // ---------------- البحث ----------------
  toggleMenu(){
    document.getElementById('menuOverlay').classList.toggle('open');
    document.getElementById('menuDrawer').classList.toggle('open');
  },
  openSearch(){
    document.getElementById('searchOverlay').classList.add('open');
    document.getElementById('searchDrawer').classList.add('open');
  },
  closeSearch(){
    document.getElementById('searchOverlay').classList.remove('open');
    document.getElementById('searchDrawer').classList.remove('open');
  },
  async doSearch(term){
    const box = document.getElementById('searchResults');
    if(!term || term.trim().length<2){ box.innerHTML=''; return; }
    const { data } = await supabaseClient.from('products').select('*')
      .eq('is_active', true).ilike('name', `%${term}%`).limit(20);
    box.innerHTML = (data && data.length) ? data.map(p=>this.productCard(p)).join('') : `<p class="empty-msg">ماكو نتائج</p>`;
  },

  openWhatsApp(text){
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank');
  }
};

app.init();
