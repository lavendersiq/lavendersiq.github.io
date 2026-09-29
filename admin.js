// ============================================================
// Lavenders — لوحة تحكم الأدمن
// ============================================================

const admin = {
  user: null,
  categories: [],

  async init(){
    const { data:{ session } } = await supabaseClient.auth.getSession();
    if(!session){ return this.renderLoginGate(); }
    this.user = session.user;

    const { data: adminRow } = await supabaseClient
      .from('admins').select('id').eq('id', this.user.id).maybeSingle();

    if(!adminRow){
      document.getElementById('authGate').innerHTML = `
        <p class="form-msg error">هذا الحساب ماله صلاحية دخول لوحة التحكم</p>
      `;
      document.getElementById('authGate').style.display='block';
      return;
    }

    document.getElementById('authGate').style.display='none';
    document.getElementById('adminPanel').style.display='block';
    await this.loadCategories();
    this.showTab('products');
  },

  renderLoginGate(){
    document.getElementById('authGate').innerHTML = `
      <h2>دخول الأدمن</h2>
      <div id="loginMsg"></div>
      <div class="form-field"><label>الإيميل</label><input id="adEmail" type="email"></div>
      <div class="form-field"><label>كلمة السر</label><input id="adPass" type="password"></div>
      <button class="primary-btn" onclick="admin.doLogin()">دخول</button>
    `;
  },

  async doLogin(){
    const email = document.getElementById('adEmail').value.trim();
    const password = document.getElementById('adPass').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(error){
      document.getElementById('loginMsg').innerHTML = `<p class="form-msg error">بيانات الدخول غير صحيحة</p>`;
      return;
    }
    location.reload();
  },

  async logout(){
    await supabaseClient.auth.signOut();
    location.reload();
  },

  async loadCategories(){
    const { data } = await supabaseClient.from('categories').select('*').order('sort_order');
    this.categories = data || [];
  },

  showTab(tab){
    ['products','categories','orders'].forEach(t=>{
      document.getElementById('tab'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('active', t===tab);
    });
    if(tab==='products') this.renderProductsTab();
    if(tab==='categories') this.renderCategoriesTab();
    if(tab==='orders') this.renderOrdersTab();
  },

  money(v){ return Number(v).toLocaleString('ar-IQ') + ' د.ع'; },

  // ================= المنتجات =================
  async renderProductsTab(){
    const box = document.getElementById('adminContent');
    box.innerHTML = `
      <h2>إضافة منتج جديد</h2>
      <div id="prodMsg"></div>
      <div class="form-field"><label>اسم المنتج</label><input id="pName"></div>
      <div class="form-field"><label>البراند (اختياري)</label><input id="pBrand"></div>
      <div class="form-field"><label>القسم</label>
        <select id="pCategory">${this.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-field"><label>الوصف</label><textarea id="pDesc" rows="2"></textarea></div>
      <div class="form-field"><label>السعر (د.ع)</label><input id="pPrice" type="number"></div>
      <div class="form-field"><label>السعر قبل الخصم (اتركه فاضي لو ماكو خصم)</label><input id="pCompare" type="number"></div>
      <div class="form-field"><label>الكمية بالمخزون</label><input id="pStock" type="number" value="0"></div>
      <div class="form-field"><label>رابط صورة المنتج</label><input id="pImage" placeholder="https://..."></div>
      <button class="primary-btn" onclick="admin.addProduct()">إضافة المنتج</button>

      <h2 style="margin-top:26px;">المنتجات الحالية</h2>
      <div id="prodListAdmin"><p class="empty-msg">جاري التحميل...</p></div>
    `;
    this.loadProductsList();
  },

  async loadProductsList(){
    const { data } = await supabaseClient.from('products').select('*, categories(name)').order('created_at', { ascending:false });
    const box = document.getElementById('prodListAdmin');
    if(!data || data.length===0){ box.innerHTML = `<p class="empty-msg">ماكو منتجات بعد</p>`; return; }
    box.innerHTML = `
      <table>
        <tr><th>الاسم</th><th>القسم</th><th>السعر</th><th>الكمية</th><th></th></tr>
        ${data.map(p=>`
          <tr>
            <td>${p.name}${p.is_active?'':' (مخفي)'}</td>
            <td>${p.categories?.name||'-'}</td>
            <td>${this.money(p.price)}</td>
            <td>${p.stock}</td>
            <td>
              <button class="mini-btn" onclick="admin.editStock('${p.id}', ${p.stock})">الكمية</button>
              <button class="mini-btn" onclick="admin.toggleActive('${p.id}', ${p.is_active})">${p.is_active?'إخفاء':'إظهار'}</button>
              <button class="mini-btn danger" onclick="admin.deleteProduct('${p.id}')">حذف</button>
            </td>
          </tr>
        `).join('')}
      </table>
    `;
  },

  async addProduct(){
    const name = document.getElementById('pName').value.trim();
    const brand = document.getElementById('pBrand').value.trim();
    const category_id = document.getElementById('pCategory').value;
    const description = document.getElementById('pDesc').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value);
    const compareRaw = document.getElementById('pCompare').value;
    const compare_at_price = compareRaw ? parseFloat(compareRaw) : null;
    const stock = parseInt(document.getElementById('pStock').value || '0');
    const image_url = document.getElementById('pImage').value.trim();
    const msg = document.getElementById('prodMsg');

    if(!name || isNaN(price)){
      msg.innerHTML = `<p class="form-msg error">لازم تكتب اسم المنتج والسعر</p>`;
      return;
    }

    const { error } = await supabaseClient.from('products').insert({
      name, brand: brand||null, category_id, description: description||null,
      price, compare_at_price, stock, image_url: image_url||null
    });

    if(error){ msg.innerHTML = `<p class="form-msg error">صار خطأ: ${error.message}</p>`; return; }
    msg.innerHTML = `<p class="form-msg success">انضاف المنتج بنجاح</p>`;
    ['pName','pBrand','pDesc','pPrice','pCompare','pImage'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('pStock').value='0';
    this.loadProductsList();
  },

  async editStock(id, current){
    const val = prompt('الكمية الجديدة بالمخزون:', current);
    if(val===null) return;
    const n = parseInt(val);
    if(isNaN(n) || n<0) return alert('اكتب رقم صحيح');
    await supabaseClient.from('products').update({ stock:n }).eq('id', id);
    this.loadProductsList();
  },

  async toggleActive(id, current){
    await supabaseClient.from('products').update({ is_active: !current }).eq('id', id);
    this.loadProductsList();
  },

  async deleteProduct(id){
    if(!confirm('متأكد تريد تحذف هذا المنتج نهائياً؟')) return;
    await supabaseClient.from('products').delete().eq('id', id);
    this.loadProductsList();
  },

  // ================= الأقسام =================
  async renderCategoriesTab(){
    const box = document.getElementById('adminContent');
    box.innerHTML = `
      <h2>إضافة قسم جديد</h2>
      <div id="catMsg"></div>
      <div class="form-field"><label>اسم القسم</label><input id="cName" placeholder="مثال: العناية بالأظافر"></div>
      <button class="primary-btn" onclick="admin.addCategory()">إضافة القسم</button>

      <h2 style="margin-top:26px;">الأقسام الحالية</h2>
      <div id="catListAdmin"></div>
    `;
    this.renderCategoriesList();
  },

  renderCategoriesList(){
    const box = document.getElementById('catListAdmin');
    box.innerHTML = `
      <table>
        <tr><th>الاسم</th><th></th></tr>
        ${this.categories.map(c=>`
          <tr>
            <td>${c.name}</td>
            <td><button class="mini-btn danger" onclick="admin.deleteCategory('${c.id}')">حذف</button></td>
          </tr>
        `).join('')}
      </table>
    `;
  },

  slugify(name){
    return 'cat-' + Math.random().toString(36).slice(2,8);
  },

  async addCategory(){
    const name = document.getElementById('cName').value.trim();
    const msg = document.getElementById('catMsg');
    if(!name){ msg.innerHTML = `<p class="form-msg error">اكتب اسم القسم</p>`; return; }
    const slug = this.slugify(name);
    const { error } = await supabaseClient.from('categories').insert({
      name, slug, sort_order: this.categories.length + 1
    });
    if(error){ msg.innerHTML = `<p class="form-msg error">صار خطأ: ${error.message}</p>`; return; }
    msg.innerHTML = `<p class="form-msg success">انضاف القسم</p>`;
    document.getElementById('cName').value='';
    await this.loadCategories();
    this.renderCategoriesList();
  },

  async deleteCategory(id){
    if(!confirm('حذف القسم؟ المنتجات الموجودة فيه تبقى بدون قسم.')) return;
    await supabaseClient.from('categories').delete().eq('id', id);
    await this.loadCategories();
    this.renderCategoriesList();
  },

  // ================= الطلبات =================
  async renderOrdersTab(){
    const box = document.getElementById('adminContent');
    box.innerHTML = `<h2>الطلبات</h2><div id="ordersAdminList"><p class="empty-msg">جاري التحميل...</p></div>`;
    const { data: orders } = await supabaseClient
      .from('orders').select('*, order_items(*)')
      .order('created_at', { ascending:false });

    const listBox = document.getElementById('ordersAdminList');
    if(!orders || orders.length===0){ listBox.innerHTML = `<p class="empty-msg">ماكو طلبات بعد</p>`; return; }

    listBox.innerHTML = orders.map(o=>{
      const itemsText = o.order_items.map(it=>`${it.product_name} ×${it.quantity}`).join('، ');
      const waText = encodeURIComponent(`مرحباً ${o.full_name}، بخصوص طلبك رقم ${o.id.slice(0,8)}: ${itemsText}`);
      return `
        <div class="order-card">
          <div style="display:flex;justify-content:space-between;">
            <strong>${o.full_name}</strong>
            <span style="font-size:12px;color:var(--muted);">${new Date(o.created_at).toLocaleString('ar-IQ')}</span>
          </div>
          <p style="font-size:13px;margin:6px 0;">📞 ${o.phone}</p>
          <p style="font-size:13px;margin:6px 0;">📍 ${o.address}</p>
          <p style="font-size:13px;margin:6px 0;">${itemsText}</p>
          <p style="font-weight:700;">${this.money(o.total)}</p>
          <div class="form-field" style="margin-top:10px;">
            <select onchange="admin.updateStatus('${o.id}', this.value)">
              ${['جديد','قيد التجهيز','تم التوصيل','ملغي'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <a href="https://wa.me/${o.phone.replace(/[^0-9]/g,'')}?text=${waText}" target="_blank">
            <button class="secondary-btn">تواصل عبر واتساب</button>
          </a>
        </div>
      `;
    }).join('');
  },

  async updateStatus(orderId, status){
    await supabaseClient.from('orders').update({ status }).eq('id', orderId);
  }
};

admin.init();
