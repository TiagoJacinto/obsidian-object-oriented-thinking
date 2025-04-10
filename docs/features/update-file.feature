Feature: Update file

Scenario: File doesn't extend another file
Given a file named "File" that doesn't extend another file
When I update the file
Then I should see the object hierarchy as "File"

Scenario: File has empty extends property
Given a file named "File" with empty extends property
When I update the file
Then I should see the object hierarchy as "File"

Scenario: File extends another file
Given the "SubFile" extends the "SuperFile"
When I update the file named "SubFile"
Then I should see the object hierarchy as "SuperFile/SubFile"

Scenario: File extends itself
Given a file that extends itself
When I update the file
Then I should see an error notifying me that the file should not extend itself
And the extends property should be empty

Scenario: File extends ignored file
Given a file that extends an ignored file
When I update the file
Then I should see an error notifying me that the file should not extend an ignored file
And the extends property should be empty

Scenario: File references itself indirectly
Given the files and corresponding object hierarchies:
 | File Name   | Object Hierarchy       |
 | Animal      | Animal                 |
 | Cat         | Animal/Cat             |
 | PersianCat  | Animal/Cat/PersianCat  |
When I extend "Animal" with "PersianCat"
Then I should see an error notifying me that the file should not extend from "PersianCat" because it references itself
And the extends property should be empty

Scenario: Updating a parent file should update descendant object hierarchy
Given the files and corresponding object hierarchies:
 | File Name | Object Hierarchy  |
 | File4     | File4       |
 | File3     | File4/File3 |
 | File2     | File2       |
 | File1     | File2/File1 |
When I extend "File2" with "File3"
Then the object hierarchy should be:
 | File Name | Object Hierarchy |
 | File4     | File4            |
 | File3     | File4/File3            |
 | File2     | File4/File3/File2            |
 | File1     | File4/File3/File2/File1            |
And "File2" should extend "File3"
And "File3" should be extended by "File2"

Scenario: Removal of link between files
Given "File1" is extending "File2"
When I remove the link between them
Then I should see that "File1" is no longer extending "File2"
And "File2" is no longer extended by "File1"
And "File1" object hierarchy is "File1"

Scenario: Save mode is instant
Given I have set the save mode setting to instant
When I change the file consecutively
Then it should always update
