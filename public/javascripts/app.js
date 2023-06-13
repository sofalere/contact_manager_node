class View {
  constructor(contactManager) {
    this.contactManager = contactManager;
    this.registerHelpers();
    this.contactToEditID = null;

    this.addButton = document.querySelector('.add_contact');
    this.formDiv = document.querySelector('.form_div');
    this.mainDiv = document.querySelector('.main_div');
    this.form = document.querySelector('form');
    this.list = document.querySelector('.list');
    this.search = document.querySelector('#search');
    
    this.bindEvents();
  }

  registerHelpers() {
    Handlebars.registerHelper('separateTagButtons', (tags) => {
      return tags.split(',').map(tag => `<button type="button" value="${tag}"class="tag" name="${tag}">${tag}</button>`).join(', ');
    });
  }

  resetList() {
    this.getContactElements().forEach(contact => contact.classList.remove('hidden'));
    this.updateHeader();
    this.showMain();
  }

  showForm() {
    this.mainDiv.classList.remove('active')
    if (!this.formDiv.classList.contains('active')) {
      this.formDiv.classList.add('active');
      this.formDiv.style.height = "auto";
      let height = this.formDiv.clientHeight + "px"
      this.formDiv.style.height = "0px"
      setTimeout(() => {
        this.formDiv.style.height = height
      }, 0) 
    }
  }

  showMain() {
    this.formDiv.classList.remove('active')
    this.mainDiv.classList.add('active');
    this.mainDiv.style.height = "auto";
    let height = this.mainDiv.clientHeight + 100 + "px"
    this.mainDiv.style.height = "0px"
    setTimeout(() => {
      this.mainDiv.style.height = height
    }, 0) 
  }

  getContactElements() {
    return document.querySelectorAll('article');
  }

  getIDByEvent(e) {
    return e.target.parentElement.id;
  }

  findElementByID(id) {
    return document.querySelector(`[id='${id}']`);
  }

  bindEvents() {
    this.addButton.addEventListener('click', this.showForm.bind(this));
    this.form.addEventListener('submit', this.addContactHandler.bind(this));
    this.list.addEventListener('click', this.deleteContactHandler.bind(this));
    this.list.addEventListener('click', this.openEditFormHandler.bind(this));
    document.querySelector('#cancelAdd').addEventListener('click', this.cancelFormHandler.bind(this));
    this.list.addEventListener('click', this.findTagsHanlder.bind(this));
    this.search.addEventListener('keyup', this.searchHandler.bind(this));
    this.list.addEventListener('click', this.backButtonHandler.bind(this));
  }

  generateHTML(contacts) {
    if (!Array.isArray(contacts)) {
      contacts = [contacts];
    }
    let context = {contacts: contacts};

    let contactTemplate = document.querySelector('#contactList').innerHTML;
    let templateScript = Handlebars.compile(contactTemplate);
    return templateScript(context);
  }

  cancelFormHandler() {
    this.form.reset();
    this.contactToEditID = null;
    this.showMain();
  }

  addContactHandler(e) {
    e.preventDefault();
    const data = new FormData(e.target);

    if (!!this.contactToEditID) {
      this.contactManager.sendContactToEdit(data, this.contactToEditID);
    } else {
      this.contactManager.sendContactToAdd(data);
    }

    this.contactToEditID = null;
    this.form.reset();
  }


  updateHeader(custom) {
    const header = this.list.querySelector("#contact_header");
    if (custom) {
      header.innerText = custom;
    } else {
      header.innerText = "Contact List";
    }
    if (this.getContactElements().length < 1) {
      header.innerText = "Sorry no contacts to display";
    }
  }

  displayContacts(contacts) {
    if (Object.keys(contacts).length > 0) {
      const html = this.generateHTML(contacts);
      document.querySelector('.list').innerHTML += html;
    }

    this.updateHeader();
    this.showMain();
  }

  displayOneLessContact(id) {
    this.findElementByID(id).remove();
    // this.resetList();
  }

  deleteContactHandler(e) {
    if (e.target.id === 'deleteContact') {
      const id = this.getIDByEvent(e);
      this.contactManager.sendContactToDelete(id);
    }
  }

  openEditFormHandler(e) {
    if (e.target.id === 'editContact') {
      const id = this.getIDByEvent(e);
      this.contactToEditID = id;
      this.contactManager.retrieveContact(this.displayContactToEdit.bind(this), id);
    }
  }

  displayContactToEdit(response) {
    this.showForm();
    this.form.name = 'Edit Contact';
    
    for (const [key, val] of Object.entries(response)) {
      const input = this.form.elements[key];
      input.value = val;

      if (key === 'tags') {
        const tags = val.split(',');
        tags.forEach(tag => this.form[tag].checked = true);
      }
    }

    this.contactToEditID = null;
  }

  displayContactAfterEdit(contact) {
    const element = this.findElementByID(contact.id);
    const html = this.generateHTML(contact);

    element.innerHTML = html;
    this.showMain();
  }

  findTagsHanlder(e) {
    if (e.target.className === 'tag') {
      const tag = e.target.value;
      this.contactManager.retrieveContactsByTag(tag);
    }
  }

  displayContactsWithTags(ids, tag) {
    let contactHeader = document.querySelector("#contact_header");
    let backButton = document.querySelector('#back_button');

    this.updateHeader(`Contacts with tag "${tag}":`);
    this.hideContactsByID(ids);
    backButton.classList.remove('hidden');
    this.showMain();
  }

  backButtonHandler(e) { 
    if (e.target.id === 'back_button') {
      document.querySelector('#back_button').classList.add('hidden');
      this.resetList();
    };
  }

  searchHandler(e) {
    let value = this.search.value;
    if (value.length > 0) {
      this.updateHeader(`Searching for contacts including "${value}"`)
      this.contactManager.retrieveContactsByChars(value);
    } else {
      this.resetList();
    }
  }

  hideContactsByID(ids) {
    this.getContactElements().forEach(contact => {
      if (!ids.includes(Number.parseInt(contact.id, 10))) {
        contact.classList.add('hidden');
      } else {
        contact.classList.remove('hidden');
      }
    });
  }
};

class Contacts {
  constructor(contactManager) {
    this.contactManager = contactManager;
  }

  serialize(data) {
    let json = {};
    for (let pair of data.entries()) {
      if (pair[1] === 'on') {
        json['tags'] = (json['tags']) ? json['tags'] + ',' + pair[0] : pair[0];
      } else {
        json[pair[0]] = pair[1];
      }
    }
    return json;
  }

  fromDatabase = async function(url, options, resolve) {
    try {
      const response = await fetch(url, options);
      const contacts = await response.json();
      resolve(contacts);
    } catch (error) {
      return error;
    }
  }

  getAllContacts(resolve) {
    this.fromDatabase("http://localhost:3000/api/contacts", null, resolve)
  }

  getContactByID(resolve, id) {
    id = Number.parseInt(id, 10);
    const url = `http://localhost:3000/api/contacts/${id}`

    this.fromDatabase(url, null, resolve);
  }

  addContact(resolve, data) {
    const json = this.serialize(data);
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(json),
    };

    this.fromDatabase("http://localhost:3000/api/contacts/", options, resolve, data)
  }

  editContact(resolve, data, id) {
    const json = this.serialize(data);
    const url = `http://localhost:3000/api/contacts/${id}`
    const options = {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(json),
    };

    this.fromDatabase(url, options, resolve, json)
  }

  deleteContact = async function(resolve, id) {
    id = Number.parseInt(id, 10);
    const url = `http://localhost:3000/api/contacts/${id}`

    try {
      const response = await fetch(url, { method: 'DELETE'});
      await response.text();
      resolve(id);
    } catch (error) {
      console.log(error);
    }
  }
};

class ContactManager {
  constructor() {
    let self = this;
    this.contacts = new Contacts(self);
    this.view = new View(self);
    this.tagsAndIDs = {};
    this.retrieveAllContacts();
  }

  reject(error) {
    this.view.alertError();
  }

  retrieveAllContacts() {
    const self = this;
    const resolve = function(response) {
      response.forEach(contact => self.storeTagPair(contact));
      self.view.displayContacts.bind(self.view)(response);
    }
    this.contacts.getAllContacts(resolve);
  }

  retrieveContact(resolve, id) {
    this.contacts.getContactByID(resolve, id);
  }

  retrieveContactsByTag(tag) {
    const tagIDs = this.tagsAndIDs[tag];
    if (tagIDs) {
      this.view.displayContactsWithTags.call(this.view, tagIDs, tag);
    }
  }

  storeTagPair(contact) {
    const id = contact.id;
    const tags = contact.tags.split(',');
    for(const tag of tags) {
      if (!this.tagsAndIDs[tag]) {
        this.tagsAndIDs[tag] = [id];
      } else if (!this.tagsAndIDs[tag].includes(id)) {
        this.tagsAndIDs[tag].push(id);
      }
    };
  }

  deleteTagPair(id) {
    for(const [tag, IDs] of Object.entries(this.tagsAndIDs)) {
      this.tagsAndIDs[tag] = IDs.filter(_id => _id !== id);

    }
  }

  sendContactToAdd(data) {
    const self = this;
    const resolve = function(response) {
      self.storeTagPair.bind(self)(response);
      self.view.displayContacts.bind(self.view)(response);
    }

    self.contacts.addContact(resolve.bind(self), data);
  }

  sendContactToDelete(id) {
    const self = this;
    const resolve = function(id) {
      self.deleteTagPair.bind(self)(id);
      self.view.displayOneLessContact.bind(self.view)(id);
    }
    self.contacts.deleteContact(resolve, id);
  }

  sendContactToEdit(data, id) {
    const self = this;
    const resolve = function(response) {
      self.storeTagPair.bind(self)(response);
      self.view.displayContactAfterEdit.bind(self.view)(response);
    }
    self.contacts.editContact(resolve, data, id);
  }

  retrieveContactsByChars(chars) {
    const self = this;
    const resolve = function(contacts) {
      const matchingIDs = contacts.filter(contact => contact.full_name.includes(chars)).map(contact => contact.id);
      self.view.hideContactsByID.bind(self.view)(matchingIDs);
    }
    self.contacts.getAllContacts(resolve);
  }
};


document.addEventListener("DOMContentLoaded", e => {
  new ContactManager();
});