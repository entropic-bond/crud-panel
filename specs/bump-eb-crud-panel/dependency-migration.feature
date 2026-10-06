Feature: crud-panel works on entropic-bond 2.x

  # Migration of the entropic-bond dependency from the 1.x line to the latest
  # v2.x release (task bump-eb-crud-panel). Upstream breaking change in 2.0.0:
  # DataSource.find() resolves a QueryCursor and DataSource.next() was removed.
  # The 1.x -> 2.x line also changed JsonDataSource delete semantics and made
  # collection listeners emit an initial snapshot on subscribe.

  Scenario: The package resolves entropic-bond 2.0.4 under the declared 2.x range. [REQ-1]
    Given The package manifest declares 'entropic-bond' with range '^2.0.4'
    When The installed entropic-bond package is resolved
    Then Its version must be '2.0.4'

  Scenario: Retrieving the document collection returns every stored document. [REQ-2]
    Given A data source holding two documents
    When The document collection is retrieved
    Then Two documents are returned

  Scenario: Retrieving the document collection honours the requested limit. [REQ-3]
    Given A data source holding three documents
    When The document collection is retrieved with limit two
    Then At most two documents are returned

  Scenario: Storing a document notifies the refreshed collection with action saved. [REQ-4]
    Given A controller over a data source holding two documents
    When A new document is stored
    Then A change with action 'saved' and the refreshed collection of three documents is notified

  Scenario: Deleting a document notifies the refreshed collection with action deleted. [REQ-5]
    Given A controller over a data source holding two documents
    When The first retrieved document is deleted
    Then A change with action 'deleted' and the refreshed collection of one document is notified

  Scenario: A retrieval error reaches error subscribers without throwing. [REQ-6]
    Given A data source that fails to find documents
    And An error subscriber is registered on the controller
    When The document collection is retrieved
    Then The find error is notified to the subscriber
    And The retrieval does not throw
